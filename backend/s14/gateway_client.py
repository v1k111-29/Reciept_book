"""HTTP client for the ledger gateway (P3's service). Owner: P4.

The backend never talks to Drunix directly: it sends contracts.GatewayRequest to the
gateway and gets contracts.GatewayResult back (routes in contracts.GATEWAY_ROUTES).
Unit tests use FakeGateway (tests/backend/fakes.py) instead of a network.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Protocol

import httpx
from pydantic import TypeAdapter, ValidationError

from s14.contracts import (
    CHAINCODE_RESULT,
    GATEWAY_ROUTES,
    ChaincodeFunction,
    ErrorBody,
    ErrorCode,
    GatewayRequest,
    GatewayResult,
    MilestoneEvent,
    ShippingBillRecord,
)

_RESULT_VALIDATORS: dict[str, TypeAdapter[object]] = {
    ShippingBillRecord.__name__: TypeAdapter(ShippingBillRecord),
    MilestoneEvent.__name__: TypeAdapter(MilestoneEvent),
    f"list[{ShippingBillRecord.__name__}]": TypeAdapter(list[ShippingBillRecord]),
}


class GatewayUnavailable(Exception):
    """The gateway could not be reached, or refused to start an event stream."""


class EventStream(Protocol):
    """An open server-sent-event stream from the gateway: iterate raw bytes, then close()."""

    def __iter__(self) -> Iterator[bytes]: ...
    def close(self) -> None: ...


class Gateway(Protocol):
    def submit(self, request: GatewayRequest) -> GatewayResult: ...
    def evaluate(self, request: GatewayRequest) -> GatewayResult: ...
    def open_events(self) -> EventStream:
        """Open GATEWAY_ROUTES["events"]. Raises GatewayUnavailable if it cannot be reached or
        does not answer 200. Iterating yields the stream's bytes verbatim (keep-alive comment
        lines included) and ends quietly if the upstream breaks."""
        ...


class _HttpEventStream:
    def __init__(self, client: httpx.Client, response: httpx.Response) -> None:
        self._client = client
        self._response = response

    def __iter__(self) -> Iterator[bytes]:
        try:
            yield from self._response.iter_raw()
        except httpx.HTTPError:
            return  # upstream broke mid-stream: end quietly, the browser reconnects

    def close(self) -> None:
        try:
            self._response.close()
        finally:
            self._client.close()


class HttpGateway:
    """Talks to the gateway at base_url (env S14_GATEWAY_URL, default http://localhost:8800)."""

    def __init__(self, base_url: str | None = None, timeout_s: float = 10.0) -> None:
        self.base_url = (
            os.environ.get("S14_GATEWAY_URL", "http://localhost:8800")
            if base_url is None
            else base_url
        )
        self.timeout_s = timeout_s

    def submit(self, request: GatewayRequest) -> GatewayResult:
        return self._call("submit", request)

    def evaluate(self, request: GatewayRequest) -> GatewayResult:
        return self._call("evaluate", request)

    def open_events(self) -> EventStream:
        path = GATEWAY_ROUTES["events"].split(" ", 1)[1]
        # No read timeout: the stream is long-lived. The connect timeout is kept.
        client = httpx.Client(
            timeout=httpx.Timeout(self.timeout_s, read=None),
        )
        try:
            response = client.send(
                client.build_request(
                    "GET",
                    f"{self.base_url.rstrip('/')}{path}",
                    headers={"Accept": "text/event-stream"},
                ),
                stream=True,
            )
        except httpx.HTTPError as exc:
            client.close()
            raise GatewayUnavailable(str(exc)) from exc
        if response.status_code != 200:
            status = response.status_code
            response.close()
            client.close()
            raise GatewayUnavailable(f"Gateway event stream answered HTTP {status}.")
        return _HttpEventStream(client, response)

    def _call(self, route: str, request: GatewayRequest) -> GatewayResult:
        path = GATEWAY_ROUTES[route].split(" ", 1)[1]
        try:
            response = httpx.post(
                f"{self.base_url.rstrip('/')}{path}",
                json=request.model_dump(mode="json"),
                timeout=self.timeout_s,
            )
        except httpx.RequestError as exc:
            return GatewayResult(
                ok=False,
                error=ErrorBody(code=ErrorCode.LEDGER_UNAVAILABLE, message=str(exc)),
            )

        try:
            result = GatewayResult.model_validate(response.json())
        except (ValueError, ValidationError):
            return GatewayResult(
                ok=False,
                error=ErrorBody(
                    code=ErrorCode.INTERNAL,
                    message=f"Gateway returned an invalid response (HTTP {response.status_code}).",
                ),
            )
        if not result.ok:
            return result

        result_shape = CHAINCODE_RESULT[request.function]
        validator = _RESULT_VALIDATORS.get(result_shape)
        if validator is None:
            return GatewayResult(
                ok=False,
                error=ErrorBody(
                    code=ErrorCode.INTERNAL,
                    message=f"Backend has no validator for the {result_shape} gateway payload.",
                ),
            )
        try:
            validator.validate_python(result.payload)
        except ValidationError:
            return GatewayResult(
                ok=False,
                error=ErrorBody(
                    code=ErrorCode.INTERNAL,
                    message=f"Gateway returned an invalid {result_shape} payload.",
                ),
            )
        return result
