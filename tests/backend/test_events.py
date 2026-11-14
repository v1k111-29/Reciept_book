"""GET /events relay, route coverage of the contract, and HttpGateway.open_events."""

from __future__ import annotations

import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from s14.api import app, get_gateway
from s14.contracts import BACKEND_ROUTES
from s14.gateway_client import GatewayUnavailable, HttpGateway
from tests.backend.fakes import FakeGateway

SSE = [
    b": keep-alive\n\n",
    b'event: MilestoneRecorded\ndata: {"name":"MilestoneRecorded"}\n\n',
    b": keep-alive\n\n",
]


@pytest.fixture(autouse=True)
def _clean():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def test_every_contract_backend_route_is_implemented():
    implemented = {
        (method, route.path) for route in app.routes if isinstance(route, APIRoute) for method in route.methods
    }
    for name, spec in BACKEND_ROUTES.items():
        method, path = spec.split(" ", 1)
        assert (method, path) in implemented, f"BACKEND_ROUTES[{name!r}] = {spec!r} is not implemented"


def test_events_relays_stream_verbatim_with_headers_and_closes():
    gateway = FakeGateway()
    gateway.event_chunks = SSE
    app.dependency_overrides[get_gateway] = lambda: gateway
    with TestClient(app).stream("GET", "/events") as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert response.headers["cache-control"] == "no-cache"
        assert response.headers["x-accel-buffering"] == "no"
        body = b"".join(response.iter_bytes())
    assert body == b"".join(SSE)
    assert gateway.streams[0].closed


def test_events_gateway_unreachable_is_ledger_unavailable():
    gateway = FakeGateway()
    gateway.events_error = "connection refused"
    app.dependency_overrides[get_gateway] = lambda: gateway
    response = TestClient(app).get("/events")
    assert response.status_code == 503
    assert response.headers["content-type"].startswith("application/json")
    assert response.json()["code"] == "LEDGER_UNAVAILABLE"


def test_events_stream_closed_when_generator_closed_early():
    gateway = FakeGateway()
    gateway.event_chunks = SSE
    app.dependency_overrides[get_gateway] = lambda: gateway
    import asyncio

    from s14.api import events

    streaming = events(gateway)
    it = streaming.body_iterator

    async def run():
        first = await it.__anext__()
        await it.aclose()
        return first

    assert asyncio.run(run()) == SSE[0]
    assert gateway.streams[0].closed


# ---- HttpGateway.open_events against a real local HTTP server


def _serve(handler_cls):
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler_cls)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


def test_http_gateway_open_events_streams_bytes():
    class H(BaseHTTPRequestHandler):
        def do_GET(self):
            assert self.path == "/events"
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Connection", "close")
            self.end_headers()
            for chunk in SSE:
                self.wfile.write(chunk)
                self.wfile.flush()

        def log_message(self, *a):
            pass

    server, url = _serve(H)
    try:
        stream = HttpGateway(url, timeout_s=2).open_events()
        try:
            assert b"".join(stream) == b"".join(SSE)
        finally:
            stream.close()
    finally:
        server.shutdown()
        server.server_close()


def test_http_gateway_open_events_non_200_and_unreachable():
    class H(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(503)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def log_message(self, *a):
            pass

    server, url = _serve(H)
    try:
        with pytest.raises(GatewayUnavailable):
            HttpGateway(url, timeout_s=2).open_events()
    finally:
        server.shutdown()
        server.server_close()
    with pytest.raises(GatewayUnavailable):
        HttpGateway(url, timeout_s=2).open_events()  # server is down now
