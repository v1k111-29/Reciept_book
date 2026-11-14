"""POST /records/{sb_hash}/reference-check (contracts 1.1.0)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from s14.api import app, get_gateway
from s14.contracts import (
    ChaincodeFunction,
    ErrorBody,
    ErrorCode,
    GatewayRequest,
    GatewayResult,
    Milestone,
    OrgRole,
)
from s14.domain.hashing import reference_hash
from tests.backend.fakes import FakeGateway
from tests.factories import SB, event, record

SALT = "test-salt"


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    app.dependency_overrides.clear()
    monkeypatch.setenv("S14_HASH_SALT", SALT)
    yield
    app.dependency_overrides.clear()


class RecordGateway(FakeGateway):
    def __init__(self, result: GatewayResult) -> None:
        super().__init__()
        self.result = result

    def evaluate(self, request: GatewayRequest) -> GatewayResult:
        self.calls.append(request)
        return self.result


def _with_reference(milestone: Milestone, raw: str, day: int):
    e = event(milestone, day=day)
    return e.model_copy(update={"reference_hash": reference_hash(raw, SALT)})


def _post(gateway, body, sb_hash=SB):
    app.dependency_overrides[get_gateway] = lambda: gateway
    return TestClient(app).post(f"/records/{sb_hash}/reference-check", json=body)


def _gw(*events):
    rec = record(*events)
    return RecordGateway(GatewayResult(ok=True, payload=rec.model_dump(mode="json")))


def test_matching_reference():
    ev = _with_reference(Milestone.DOCS_ACKNOWLEDGED, "doc-sha", 1)
    gateway = _gw(ev)
    response = _post(gateway, {"milestone": "DOCS_ACKNOWLEDGED", "reference": " doc-sha "})
    assert response.status_code == 200
    body = response.json()
    assert body["recorded"] is True and body["matches"] is True
    assert body["tx_id"] == ev.tx_id
    assert body["sb_hash"] == SB
    assert gateway.calls == [
        GatewayRequest(function=ChaincodeFunction.GET_RECORD, args=(SB,), identity=OrgRole.AD_BANK)
    ]


def test_wrong_reference_reports_recorded_event():
    ev = _with_reference(Milestone.PAYMENT_RECEIVED, "irm-1", 2)
    body = _post(_gw(ev), {"milestone": "PAYMENT_RECEIVED", "reference": "irm-2"}).json()
    assert (body["recorded"], body["matches"]) == (True, False)
    assert body["tx_id"] == ev.tx_id
    assert body["ledger_time"] is not None


def test_milestone_absent():
    gateway = _gw(_with_reference(Milestone.DOCS_ACKNOWLEDGED, "x", 1))
    body = _post(gateway, {"milestone": "PAYMENT_RECEIVED", "reference": "x"}).json()
    assert body == {
        "sb_hash": SB,
        "milestone": "PAYMENT_RECEIVED",
        "recorded": False,
        "matches": False,
        "tx_id": None,
        "ledger_time": None,
    }


def test_several_events_match_any_else_latest():
    first = _with_reference(Milestone.PAYMENT_RECEIVED, "a", 1)
    second = _with_reference(Milestone.PAYMENT_RECEIVED, "b", 3).model_copy(update={"tx_id": "tx-late"})
    gateway = _gw(first, second)
    hit = _post(gateway, {"milestone": "PAYMENT_RECEIVED", "reference": "a"}).json()
    assert hit["matches"] is True and hit["tx_id"] == first.tx_id
    miss = _post(gateway, {"milestone": "PAYMENT_RECEIVED", "reference": "zzz"}).json()
    assert miss["matches"] is False and miss["tx_id"] == "tx-late"


def test_not_found_passes_through():
    gateway = RecordGateway(
        GatewayResult(ok=False, error=ErrorBody(code=ErrorCode.NOT_FOUND, message="no record"))
    )
    response = _post(gateway, {"milestone": "DOCS_ACKNOWLEDGED", "reference": "x"})
    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"


def test_blank_reference_is_validation_and_reads_nothing():
    gateway = _gw()
    response = _post(gateway, {"milestone": "DOCS_ACKNOWLEDGED", "reference": "  "})
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION"
    assert gateway.calls == []


def test_milestone_without_reference_is_validation():
    response = _post(_gw(), {"milestone": "EDPMS_MARKED_OFF", "reference": "x"})
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION"


def test_missing_salt_is_internal(monkeypatch):
    monkeypatch.delenv("S14_HASH_SALT")
    response = _post(_gw(), {"milestone": "DOCS_ACKNOWLEDGED", "reference": "x"})
    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL"


def test_nothing_is_submitted_and_reference_not_leaked():
    gateway = _gw(_with_reference(Milestone.DOCS_ACKNOWLEDGED, "secret-ref", 1))
    _post(gateway, {"milestone": "DOCS_ACKNOWLEDGED", "reference": "secret-ref"})
    assert all(c.function is ChaincodeFunction.GET_RECORD for c in gateway.calls)
    assert "secret-ref" not in repr(gateway.calls)
