"""In-memory fake of the gateway for backend unit tests. Owner: P4.

It is a TEST DOUBLE only. The product runs against the real Drunix network (decision D-03).
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator

from s14.contracts import GatewayRequest, GatewayResult
from s14.gateway_client import GatewayUnavailable


class FakeEventStream:
    def __init__(self, chunks: Iterable[bytes], fail_after: bool = False) -> None:
        self._chunks = list(chunks)
        self._fail_after = fail_after
        self.closed = False

    def __iter__(self) -> Iterator[bytes]:
        yield from self._chunks
        if self._fail_after:
            return  # a broken upstream ends quietly, like HttpGateway

    def close(self) -> None:
        self.closed = True


class FakeGateway:
    def __init__(self) -> None:
        self.calls: list[GatewayRequest] = []
        self.event_chunks: list[bytes] = []
        self.events_error: str | None = None  # set to make open_events raise GatewayUnavailable
        self.streams: list[FakeEventStream] = []

    def submit(self, request: GatewayRequest) -> GatewayResult:
        self.calls.append(request)
        return GatewayResult(ok=True, tx_id=f"fake-{len(self.calls)}")

    def evaluate(self, request: GatewayRequest) -> GatewayResult:
        self.calls.append(request)
        return GatewayResult(ok=True, payload=None)

    def open_events(self) -> FakeEventStream:
        if self.events_error is not None:
            raise GatewayUnavailable(self.events_error)
        stream = FakeEventStream(self.event_chunks)
        self.streams.append(stream)
        return stream
