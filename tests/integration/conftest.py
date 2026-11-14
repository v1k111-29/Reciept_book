"""Fixtures for the live Drunix tests. Owner: P1. The client is in live_client.py."""

from __future__ import annotations

import os

import pytest

from tests.integration.live_client import LiveGateway, synthetic_hash


@pytest.fixture(scope="session")
def gw() -> LiveGateway:
    return LiveGateway(os.environ.get("S14_GATEWAY_URL", "http://localhost:8800"))


@pytest.fixture
def sb_hash() -> str:
    return synthetic_hash("sb")


LIVE_SALT = "s14-live-synthetic-test-salt"


@pytest.fixture(scope="session")
def backend_url():
    """The backend under test. S14_BACKEND_URL points at a running one (its salt must then be
    S14_HASH_SALT here); otherwise the app is served in-process on a free port, talking to the
    gateway at S14_GATEWAY_URL. Only used by live tests."""
    external = os.environ.get("S14_BACKEND_URL")
    if external:
        yield external.rstrip("/")
        return
    import socket
    import threading
    import time

    import uvicorn

    os.environ.setdefault("S14_HASH_SALT", LIVE_SALT)
    from s14.api import app

    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.time() + 15
    while not server.started and time.time() < deadline:
        time.sleep(0.05)
    assert server.started, "in-process backend did not start"
    yield f"http://127.0.0.1:{port}"
    server.should_exit = True
    thread.join(timeout=5)
