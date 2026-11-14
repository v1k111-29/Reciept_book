"""POST /customs/import (contracts 1.1.0)."""

from __future__ import annotations

import json
from datetime import date

import pytest
from fastapi.testclient import TestClient

import s14.api as api
from s14.api import app, get_gateway
from s14.contracts import CustomsStatus, ErrorBody, ErrorCode, GatewayRequest, GatewayResult, OrgRole
from s14.domain.hashing import shipping_bill_hash
from tests.backend.fakes import FakeGateway

SALT = "test-salt"


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    app.dependency_overrides.clear()
    monkeypatch.setenv("S14_HASH_SALT", SALT)
    monkeypatch.setattr(api, "MVCC_RETRY_BACKOFF_SECONDS", 0)
    yield
    app.dependency_overrides.clear()


class ScriptedGateway(FakeGateway):
    """submit() answers come from `script` (a list of results), in call order."""

    def __init__(self, script: list[GatewayResult]) -> None:
        super().__init__()
        self.script = list(script)

    def submit(self, request: GatewayRequest) -> GatewayResult:
        self.calls.append(request)
        return self.script.pop(0)


def _err(code: ErrorCode, tx_id: str | None = None) -> GatewayResult:
    return GatewayResult(ok=False, tx_id=tx_id, error=ErrorBody(code=code, message=code.value))


def _row(n: str = "SB1", port: str = "INMAA1", status: str = "PENDING", observed: str = "2026-11-02"):
    return {
        "sb_number": n,
        "port_code": port,
        "sb_date": "2026-10-20",
        "customs_status": status,
        "observed_on": observed,
    }


def _post(gateway, rows):
    app.dependency_overrides[get_gateway] = lambda: gateway
    return TestClient(app).post("/customs/import", json={"rows": rows})


def test_rows_recorded_in_order_as_exporters_body_customs_milestones():
    gateway = ScriptedGateway([GatewayResult(ok=True, tx_id="t1"), GatewayResult(ok=True, tx_id="t2")])
    response = _post(gateway, [_row("SB1"), _row("SB2", status="REALISED", observed="2026-11-05")])
    assert response.status_code == 200
    body = response.json()
    assert (body["total"], body["recorded"], body["not_found"], body["failed"]) == (2, 2, 0, 0)
    h1 = shipping_bill_hash("SB1", "INMAA1", date(2026, 10, 20), SALT)
    assert body["rows"][0] == {"row": 1, "sb_hash": h1, "outcome": "RECORDED", "tx_id": "t1", "error": None}
    assert body["rows"][1]["tx_id"] == "t2"
    call = gateway.calls[1]
    assert call.identity is OrgRole.EXPORTERS_BODY
    assert json.loads(call.args[0]) == {
        "sb_hash": shipping_bill_hash("SB2", "INMAA1", date(2026, 10, 20), SALT),
        "milestone": "CUSTOMS_STATUS_OBSERVED",
        "occurred_on": "2026-11-05",
        "customs_status": "REALISED",
    }
    assert "SB2" not in repr(gateway.calls)


def test_failed_row_does_not_stop_the_rest_and_totals_add_up():
    gateway = ScriptedGateway(
        [
            _err(ErrorCode.NOT_FOUND),
            _err(ErrorCode.ENDORSEMENT_FAILED),
            GatewayResult(ok=True, tx_id="t3"),
        ]
    )
    rows = [_row("A"), _row("B"), _row("  ", status="PENDING"), _row("C")]
    body = _post(gateway, rows).json()
    assert [r["outcome"] for r in body["rows"]] == ["NOT_FOUND", "FAILED", "FAILED", "RECORDED"]
    assert (body["total"], body["recorded"], body["not_found"], body["failed"]) == (4, 1, 1, 2)
    assert body["total"] == body["recorded"] + body["not_found"] + body["failed"]
    assert body["rows"][0]["error"] is None and body["rows"][0]["sb_hash"] is not None
    assert body["rows"][1]["error"]["code"] == "ENDORSEMENT_FAILED"
    blank = body["rows"][2]
    assert blank["sb_hash"] is None and blank["error"]["code"] == "VALIDATION" and blank["row"] == 3
    assert len(gateway.calls) == 3  # the blank row never reached the gateway


def test_blank_port_code_fails_row():
    body = _post(ScriptedGateway([]), [_row(port=" ")]).json()
    assert body["rows"][0]["outcome"] == "FAILED"
    assert body["rows"][0]["error"]["code"] == "VALIDATION"


def test_mvcc_conflict_is_retried_per_row():
    gateway = ScriptedGateway([_err(ErrorCode.MVCC_CONFLICT), GatewayResult(ok=True, tx_id="t-retry")])
    body = _post(gateway, [_row()]).json()
    assert body["rows"][0]["outcome"] == "RECORDED" and body["rows"][0]["tx_id"] == "t-retry"
    assert len(gateway.calls) == 2


def test_outcome_unknown_confirmed_by_read_back_is_recorded():
    h = shipping_bill_hash("SB1", "INMAA1", date(2026, 10, 20), SALT)
    from tests.factories import customs, record

    ev = customs(CustomsStatus.PENDING, day=2, sb_hash=h).model_copy(update={"tx_id": "t-unk"})
    payload = record(ev, sb_hash=h).model_dump(mode="json")

    class G(ScriptedGateway):
        def evaluate(self, request):
            self.calls.append(request)
            return GatewayResult(ok=True, payload=payload)

    gateway = G([_err(ErrorCode.OUTCOME_UNKNOWN, tx_id="t-unk")])
    body = _post(gateway, [_row()]).json()
    assert body["rows"][0]["outcome"] == "RECORDED" and body["rows"][0]["tx_id"] == "t-unk"
    assert len([c for c in gateway.calls if isinstance(c, GatewayRequest)]) == 2  # one submit, one read


def test_outcome_unknown_not_confirmed_is_failed_and_not_retried():
    class G(ScriptedGateway):
        def evaluate(self, request):
            self.calls.append(request)
            return _err(ErrorCode.NOT_FOUND)

    gateway = G([_err(ErrorCode.OUTCOME_UNKNOWN, tx_id="t-unk")])
    body = _post(gateway, [_row()]).json()
    assert body["rows"][0]["outcome"] == "FAILED"
    assert body["rows"][0]["error"]["code"] == "OUTCOME_UNKNOWN"


def test_missing_salt_fails_whole_request(monkeypatch):
    monkeypatch.delenv("S14_HASH_SALT")
    gateway = ScriptedGateway([])
    response = _post(gateway, [_row()])
    assert response.status_code == 500 and response.json()["code"] == "INTERNAL"
    assert gateway.calls == []


def test_empty_and_oversized_requests_are_validation():
    gateway = ScriptedGateway([])
    for rows in ([], [_row()] * 201):
        response = _post(gateway, rows)
        assert response.status_code == 422 and response.json()["code"] == "VALIDATION"


def test_never_creates_records():
    gateway = ScriptedGateway([_err(ErrorCode.NOT_FOUND)])
    _post(gateway, [_row()])
    assert [c.function.value for c in gateway.calls] == ["RecordMilestone"]
