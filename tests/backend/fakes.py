"""In-memory fake of the gateway for backend unit tests. Owner: P4.

It is a TEST DOUBLE only. The product runs against the real Drunix network (decision D-03).
"""

from __future__ import annotations

from s14.contracts import GatewayRequest, GatewayResult


class FakeGateway:
    def __init__(self) -> None:
        self.calls: list[GatewayRequest] = []

    def submit(self, request: GatewayRequest) -> GatewayResult:
        self.calls.append(request)
        return GatewayResult(ok=True, tx_id=f"fake-{len(self.calls)}")

    def evaluate(self, request: GatewayRequest) -> GatewayResult:
        self.calls.append(request)
        return GatewayResult(ok=True, payload=None)
