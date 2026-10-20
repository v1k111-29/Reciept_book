"""HTTP client for the ledger gateway (P3's service). Owner: P4.

The backend never talks to Drunix directly: it sends contracts.GatewayRequest to the
gateway and gets contracts.GatewayResult back (routes in contracts.GATEWAY_ROUTES).
Unit tests use FakeGateway (tests/backend/fakes.py) instead of a network.
"""

from __future__ import annotations

import os
from typing import Protocol

import httpx
from pydantic import ValidationError

from s14.contracts import (
    GATEWAY_ROUTES,
    ErrorBody,
    ErrorCode,
    GatewayRequest,
    GatewayResult,
)


class Gateway(Protocol):
    def submit(self, request: GatewayRequest) -> GatewayResult: ...
    def evaluate(self, request: GatewayRequest) -> GatewayResult: ...


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
            return GatewayResult.model_validate(response.json())
        except (ValueError, ValidationError):
            return GatewayResult(
                ok=False,
                error=ErrorBody(
                    code=ErrorCode.INTERNAL,
                    message=f"Gateway returned an invalid response (HTTP {response.status_code}).",
                ),
            )
