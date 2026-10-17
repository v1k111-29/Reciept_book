"""Owner: P4. Green from G0."""

from fastapi.testclient import TestClient

from s14.api import app
from s14.contracts import CONTRACTS_VERSION


def test_health():
    r = TestClient(app).get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "contracts_version": CONTRACTS_VERSION}
