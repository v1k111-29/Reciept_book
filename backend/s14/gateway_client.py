"""HTTP client for the ledger gateway (P3's service). Owner: P4.

The backend never talks to Drunix directly: it sends contracts.GatewayRequest to the
gateway and gets contracts.GatewayResult back (routes in contracts.GATEWAY_ROUTES).
Unit tests use FakeGateway (tests/backend/fakes.py) instead of a network.
"""

from __future__ import annotations

from typing import Protocol

from s14.contracts import GatewayRequest, GatewayResult


class Gateway(Protocol):
    def submit(self, request: GatewayRequest) -> GatewayResult: ...
    def evaluate(self, request: GatewayRequest) -> GatewayResult: ...


class HttpGateway:
    """Talks to the gateway at base_url (env S14_GATEWAY_URL, default http://localhost:8800)."""

    def __init__(self, base_url: str = "http://localhost:8800", timeout_s: float = 10.0) -> None:
        self.base_url = base_url
        self.timeout_s = timeout_s

    def submit(self, request: GatewayRequest) -> GatewayResult:
        raise NotImplementedError("P4: implement in G2")

    def evaluate(self, request: GatewayRequest) -> GatewayResult:
        raise NotImplementedError("P4: implement in G2")
