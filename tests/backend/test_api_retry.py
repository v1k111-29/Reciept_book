"""Bounded retry of write submits (REQ-p1-34, D-21). Owner: P4.

Only codes in RETRYABLE_ERRORS (MVCC_CONFLICT) are retried, at most api.MVCC_MAX_ATTEMPTS
submits in total. OUTCOME_UNKNOWN and every other error are never resubmitted.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient

import s14.api as api
from s14.api import app, get_gateway
from s14.contracts import (
    RETRYABLE_ERRORS,
    ChaincodeFunction,
    ErrorBody,
    ErrorCode,
    GatewayRequest,
    GatewayResult,
    Milestone,
    MilestoneEvent,
    OrgRole,
    ShippingBillRecord,
)
from s14.domain.hashing import shipping_bill_hash
from tests.backend.fakes import FakeGateway

SB_HASH = "e" * 64
CREATE = ("/records", {"sb_number": "SB-42", "port_code": "INMAA1", "sb_date": "2026-10-20"})
MILESTONE = (
    f"/records/{SB_HASH}/milestones",
    {
        "milestone": "PAYMENT_RECEIVED",
        "occurred_on": "2026-10-19",
        "acting_as": "AD_BANK",
        "reference": "IRM-SYNTHETIC-42",
    },
)
WRITE_ROUTES = pytest.mark.parametrize(("path", "body"), [CREATE, MILESTONE], ids=["create", "milestone"])


@pytest.fixture(autouse=True)
def no_backoff_and_clean_overrides(monkeypatch):
    monkeypatch.setenv("S14_HASH_SALT", "test-salt")
    monkeypatch.setattr(api, "MVCC_RETRY_BACKOFF_SECONDS", 0)
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def _failure(code: ErrorCode, tx_id: str | None = None) -> GatewayResult:
    return GatewayResult(ok=False, tx_id=tx_id, error=ErrorBody(code=code, message=f"{code.value} from gateway"))


class ScriptedGateway(FakeGateway):
    """Returns the scripted submit results in order; the last one repeats."""

    def __init__(self, *results: GatewayResult) -> None:
        super().__init__()
        self.results = list(results)
        self.submits = 0

    def submit(self, request: GatewayRequest) -> GatewayResult:
        self.calls.append(request)
        result = self.results[min(self.submits, len(self.results) - 1)]
        self.submits += 1
        return result


def _use(gateway: FakeGateway) -> FakeGateway:
    app.dependency_overrides[get_gateway] = lambda: gateway
    return gateway


def test_mvcc_conflict_is_the_only_retryable_error():
    assert RETRYABLE_ERRORS == frozenset({ErrorCode.MVCC_CONFLICT})
    assert ErrorCode.OUTCOME_UNKNOWN not in RETRYABLE_ERRORS
    assert api.MVCC_MAX_ATTEMPTS == 3


@WRITE_ROUTES
def test_mvcc_conflict_then_success_returns_second_tx_id(path, body):
    gateway = _use(
        ScriptedGateway(_failure(ErrorCode.MVCC_CONFLICT, tx_id="tx-1"), GatewayResult(ok=True, tx_id="tx-2"))
    )

    response = TestClient(app).post(path, json=body)

    assert response.status_code == 200
    assert response.json()["tx_id"] == "tx-2"
    assert gateway.submits == 2
    assert gateway.calls[0] == gateway.calls[1]


@WRITE_ROUTES
def test_mvcc_conflict_every_time_returns_409_after_three_submits(path, body):
    gateway = _use(ScriptedGateway(_failure(ErrorCode.MVCC_CONFLICT, tx_id="tx-n")))

    response = TestClient(app).post(path, json=body)

    assert response.status_code == 409
    assert response.json() == {"code": "MVCC_CONFLICT", "message": "MVCC_CONFLICT from gateway"}
    assert gateway.submits == 3
    assert len(gateway.calls) == 3
    assert gateway.calls[0] == gateway.calls[1] == gateway.calls[2]


def test_retries_wait_the_fixed_backoff_between_attempts(monkeypatch):
    monkeypatch.setattr(api, "MVCC_RETRY_BACKOFF_SECONDS", 0.25)
    sleeps: list[float] = []
    monkeypatch.setattr(api.time, "sleep", sleeps.append)
    gateway = _use(ScriptedGateway(_failure(ErrorCode.MVCC_CONFLICT)))

    response = TestClient(app).post(CREATE[0], json=CREATE[1])

    assert response.status_code == 409
    assert gateway.submits == 3
    assert sleeps == [0.25, 0.25]


@WRITE_ROUTES
def test_outcome_unknown_is_never_resubmitted(path, body):
    class UnknownGateway(ScriptedGateway):
        def evaluate(self, request: GatewayRequest) -> GatewayResult:
            self.calls.append(request)
            return _failure(ErrorCode.NOT_FOUND)

    gateway = _use(UnknownGateway(_failure(ErrorCode.OUTCOME_UNKNOWN, tx_id="unknown-tx")))

    response = TestClient(app).post(path, json=body)

    assert response.status_code == 504
    assert response.json()["code"] == "OUTCOME_UNKNOWN"
    assert gateway.submits == 1
    assert [call.function for call in gateway.calls][1:] == [ChaincodeFunction.GET_RECORD]


def test_create_outcome_unknown_after_mvcc_conflict_is_not_trusted_to_read_back():
    # The record exists, but a concurrent create may have won the MVCC race, and a record
    # carries no creating tx_id, so existence does not prove that tx-2 committed.
    record = ShippingBillRecord(
        sb_hash=shipping_bill_hash("SB-42", "INMAA1", date(2026, 10, 20), "test-salt"),
        bank_msp="Org1MSP",
        created_ledger_time=datetime(2026, 10, 20, tzinfo=UTC),
    )

    class ReadBackGateway(ScriptedGateway):
        def evaluate(self, request: GatewayRequest) -> GatewayResult:
            self.calls.append(request)
            return GatewayResult(ok=True, payload=record.model_dump(mode="json"))

    gateway = _use(
        ReadBackGateway(
            _failure(ErrorCode.MVCC_CONFLICT, tx_id="tx-1"),
            _failure(ErrorCode.OUTCOME_UNKNOWN, tx_id="tx-2"),
            GatewayResult(ok=True, tx_id="tx-3"),
        )
    )

    response = TestClient(app).post(CREATE[0], json=CREATE[1])

    assert response.status_code == 504
    assert response.json()["code"] == "OUTCOME_UNKNOWN"
    assert gateway.submits == 2
    assert [call.function for call in gateway.calls] == [
        ChaincodeFunction.CREATE_RECORD,
        ChaincodeFunction.CREATE_RECORD,
    ]


def test_milestone_outcome_unknown_after_mvcc_conflict_reads_back_by_tx_id():
    sb_hash = "a" * 64
    event = MilestoneEvent(
        sb_hash=sb_hash,
        milestone=Milestone.PAYMENT_RECEIVED,
        occurred_on=date(2026, 10, 20),
        reference_hash="b" * 64,
        tx_id="tx-2",
        ledger_time=datetime(2026, 10, 20, 9, tzinfo=UTC),
        submitter_msp="Org1MSP",
        submitter_role=OrgRole.AD_BANK,
    )
    record = ShippingBillRecord(
        sb_hash=sb_hash,
        bank_msp="Org1MSP",
        created_ledger_time=datetime(2026, 10, 20, tzinfo=UTC),
        events=(event,),
    )

    class ReadBackGateway(ScriptedGateway):
        def evaluate(self, request: GatewayRequest) -> GatewayResult:
            self.calls.append(request)
            return GatewayResult(ok=True, payload=record.model_dump(mode="json"))

    gateway = _use(
        ReadBackGateway(
            _failure(ErrorCode.MVCC_CONFLICT, tx_id="tx-1"),
            _failure(ErrorCode.OUTCOME_UNKNOWN, tx_id="tx-2"),
        )
    )

    response = TestClient(app).post(
        f"/records/{sb_hash}/milestones",
        json={"milestone": "PAYMENT_RECEIVED", "occurred_on": "2026-10-20", "acting_as": "AD_BANK", "reference": "IRM-1"},
    )

    assert response.status_code == 200
    assert response.json() == {"sb_hash": sb_hash, "tx_id": "tx-2"}
    assert gateway.submits == 2


@WRITE_ROUTES
@pytest.mark.parametrize(
    "code",
    [code for code in ErrorCode if code not in RETRYABLE_ERRORS and code is not ErrorCode.OUTCOME_UNKNOWN],
)
def test_non_retryable_errors_are_submitted_once(path, body, code):
    gateway = _use(ScriptedGateway(_failure(code), GatewayResult(ok=True, tx_id="never")))

    response = TestClient(app).post(path, json=body)

    assert response.json()["code"] == code.value
    assert gateway.submits == 1


def test_wrong_role_is_not_retried():
    gateway = _use(ScriptedGateway(_failure(ErrorCode.WRONG_ROLE), GatewayResult(ok=True, tx_id="never")))

    response = TestClient(app).post(MILESTONE[0], json=MILESTONE[1])

    assert response.status_code == 403
    assert response.json() == {"code": "WRONG_ROLE", "message": "WRONG_ROLE from gateway"}
    assert gateway.submits == 1
