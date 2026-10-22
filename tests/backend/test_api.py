"""API route tests using the gateway test double."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient

from s14.api import app, get_gateway
from s14.contracts import (
    ChaincodeFunction,
    CustomsStatus,
    ErrorBody,
    ErrorCode,
    GatewayRequest,
    GatewayResult,
    Milestone,
    MilestoneEvent,
    OrgRole,
    ShippingBillRecord,
)
from s14.domain.hashing import reference_hash, shipping_bill_hash
from tests.backend.fakes import FakeGateway
from tests.factories import T0, customs, event, record


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def test_create_record_hashes_identifiers_and_submits_with_bank_identity(monkeypatch):
    monkeypatch.setenv("S14_HASH_SALT", "test-salt")
    gateway = FakeGateway()
    app.dependency_overrides[get_gateway] = lambda: gateway

    response = TestClient(app).post(
        "/records",
        json={"sb_number": "SB-42", "port_code": "inmaa1", "sb_date": "2026-10-20"},
    )

    expected_hash = shipping_bill_hash("SB-42", "inmaa1", date(2026, 10, 20), "test-salt")
    assert response.status_code == 200
    assert response.json() == {"sb_hash": expected_hash, "tx_id": "fake-1"}
    assert gateway.calls == [
        GatewayRequest(
            function=ChaincodeFunction.CREATE_RECORD,
            args=(expected_hash,),
            identity=OrgRole.AD_BANK,
        )
    ]
    assert "SB-42" not in repr(gateway.calls)


def test_record_milestone_hashes_reference_and_sends_contract_payload(monkeypatch):
    monkeypatch.setenv("S14_HASH_SALT", "test-salt")
    gateway = FakeGateway()
    app.dependency_overrides[get_gateway] = lambda: gateway
    sb_hash = "a" * 64

    response = TestClient(app).post(
        f"/records/{sb_hash}/milestones",
        json={
            "milestone": "PAYMENT_RECEIVED",
            "occurred_on": "2026-10-19",
            "acting_as": "AD_BANK",
            "reference": "IRM-SYNTHETIC-42",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"sb_hash": sb_hash, "tx_id": "fake-1"}
    call = gateway.calls[0]
    assert call.function is ChaincodeFunction.RECORD_MILESTONE
    assert call.identity is OrgRole.AD_BANK
    submission = json.loads(call.args[0])
    assert submission == {
        "sb_hash": sb_hash,
        "milestone": "PAYMENT_RECEIVED",
        "occurred_on": "2026-10-19",
        "reference_hash": reference_hash("IRM-SYNTHETIC-42", "test-salt"),
    }
    assert "IRM-SYNTHETIC-42" not in call.args[0]


def test_get_timeline_returns_record_and_assessment():
    sb_hash = "b" * 64
    record = ShippingBillRecord(
        sb_hash=sb_hash,
        bank_msp="Org1MSP",
        created_ledger_time=datetime(2026, 10, 20, tzinfo=UTC),
    )

    class TimelineGateway(FakeGateway):
        def evaluate(self, request: GatewayRequest) -> GatewayResult:
            self.calls.append(request)
            return GatewayResult(ok=True, payload=record.model_dump(mode="json"))

    gateway = TimelineGateway()
    app.dependency_overrides[get_gateway] = lambda: gateway

    response = TestClient(app).get(f"/records/{sb_hash}")

    assert response.status_code == 200
    assert response.json()["record"]["sb_hash"] == sb_hash
    assert response.json()["assessment"]["bucket"] == "CONSISTENT"
    assert gateway.calls == [
        GatewayRequest(
            function=ChaincodeFunction.GET_RECORD,
            args=(sb_hash,),
            identity=OrgRole.AD_BANK,
        )
    ]


def test_gateway_errors_are_returned_with_contract_http_status(monkeypatch):
    monkeypatch.setenv("S14_HASH_SALT", "test-salt")

    class FailingGateway(FakeGateway):
        def submit(self, request: GatewayRequest) -> GatewayResult:
            self.calls.append(request)
            return GatewayResult(
                ok=False,
                error=ErrorBody(code=ErrorCode.ALREADY_EXISTS, message="record exists"),
            )

    gateway = FailingGateway()
    app.dependency_overrides[get_gateway] = lambda: gateway

    response = TestClient(app).post(
        "/records",
        json={"sb_number": "SB-42", "port_code": "INMAA1", "sb_date": "2026-10-20"},
    )

    assert response.status_code == 409
    assert response.json() == {"code": "ALREADY_EXISTS", "message": "record exists"}


def test_unknown_create_outcome_checks_for_the_record_without_resubmitting(monkeypatch):
    monkeypatch.setenv("S14_HASH_SALT", "test-salt")
    sb_hash = shipping_bill_hash("SB-42", "INMAA1", date(2026, 10, 20), "test-salt")
    record = ShippingBillRecord(
        sb_hash=sb_hash,
        bank_msp="Org1MSP",
        created_ledger_time=datetime(2026, 10, 20, tzinfo=UTC),
    )

    class UnknownCreateGateway(FakeGateway):
        def submit(self, request: GatewayRequest) -> GatewayResult:
            self.calls.append(request)
            return GatewayResult(
                ok=False,
                tx_id="unknown-tx",
                error=ErrorBody(code=ErrorCode.OUTCOME_UNKNOWN, message="commit status unknown"),
            )

        def evaluate(self, request: GatewayRequest) -> GatewayResult:
            self.calls.append(request)
            return GatewayResult(ok=True, payload=record.model_dump(mode="json"))

    gateway = UnknownCreateGateway()
    app.dependency_overrides[get_gateway] = lambda: gateway

    response = TestClient(app).post(
        "/records",
        json={"sb_number": "SB-42", "port_code": "INMAA1", "sb_date": "2026-10-20"},
    )

    assert response.status_code == 200
    assert response.json() == {"sb_hash": sb_hash, "tx_id": "unknown-tx"}
    assert [call.function for call in gateway.calls] == [
        ChaincodeFunction.CREATE_RECORD,
        ChaincodeFunction.GET_RECORD,
    ]


def test_unknown_milestone_outcome_requires_matching_transaction_in_record(monkeypatch):
    monkeypatch.setenv("S14_HASH_SALT", "test-salt")
    sb_hash = "f" * 64
    record = ShippingBillRecord(
        sb_hash=sb_hash,
        bank_msp="Org1MSP",
        created_ledger_time=datetime(2026, 10, 20, tzinfo=UTC),
        events=(),
    )

    class UnknownMilestoneGateway(FakeGateway):
        def submit(self, request: GatewayRequest) -> GatewayResult:
            self.calls.append(request)
            return GatewayResult(
                ok=False,
                tx_id="unknown-tx",
                error=ErrorBody(code=ErrorCode.OUTCOME_UNKNOWN, message="commit status unknown"),
            )

        def evaluate(self, request: GatewayRequest) -> GatewayResult:
            self.calls.append(request)
            return GatewayResult(ok=True, payload=record.model_dump(mode="json"))

    gateway = UnknownMilestoneGateway()
    app.dependency_overrides[get_gateway] = lambda: gateway

    response = TestClient(app).post(
        f"/records/{sb_hash}/milestones",
        json={
            "milestone": "PAYMENT_RECEIVED",
            "occurred_on": "2026-10-19",
            "acting_as": "AD_BANK",
            "reference": "IRM-SYNTHETIC-42",
        },
    )

    assert response.status_code == 504
    assert response.json() == {"code": "OUTCOME_UNKNOWN", "message": "commit status unknown"}
    assert [call.function for call in gateway.calls] == [
        ChaincodeFunction.RECORD_MILESTONE,
        ChaincodeFunction.GET_RECORD,
    ]


def test_unknown_milestone_outcome_is_confirmed_by_transaction_id(monkeypatch):
    monkeypatch.setenv("S14_HASH_SALT", "test-salt")
    sb_hash = "9" * 64
    event = MilestoneEvent(
        sb_hash=sb_hash,
        milestone=Milestone.PAYMENT_RECEIVED,
        occurred_on=date(2026, 10, 19),
        reference_hash="a" * 64,
        tx_id="unknown-tx",
        ledger_time=datetime(2026, 10, 20, tzinfo=UTC),
        submitter_msp="Org1MSP",
        submitter_role=OrgRole.AD_BANK,
    )
    record = ShippingBillRecord(
        sb_hash=sb_hash,
        bank_msp="Org1MSP",
        created_ledger_time=datetime(2026, 10, 20, tzinfo=UTC),
        events=(event,),
    )

    class UnknownMilestoneGateway(FakeGateway):
        def submit(self, request: GatewayRequest) -> GatewayResult:
            self.calls.append(request)
            return GatewayResult(
                ok=False,
                tx_id="unknown-tx",
                error=ErrorBody(code=ErrorCode.OUTCOME_UNKNOWN, message="commit status unknown"),
            )

        def evaluate(self, request: GatewayRequest) -> GatewayResult:
            self.calls.append(request)
            return GatewayResult(ok=True, payload=record.model_dump(mode="json"))

    gateway = UnknownMilestoneGateway()
    app.dependency_overrides[get_gateway] = lambda: gateway

    response = TestClient(app).post(
        f"/records/{sb_hash}/milestones",
        json={
            "milestone": "PAYMENT_RECEIVED",
            "occurred_on": "2026-10-19",
            "acting_as": "AD_BANK",
            "reference": "IRM-SYNTHETIC-42",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"sb_hash": sb_hash, "tx_id": "unknown-tx"}
    assert [call.function for call in gateway.calls] == [
        ChaincodeFunction.RECORD_MILESTONE,
        ChaincodeFunction.GET_RECORD,
    ]


def test_invalid_request_uses_error_body_shape():
    response = TestClient(app).post("/records", json={"sb_number": "SB-42"})

    assert response.status_code == 422
    assert response.json() == {"code": "VALIDATION", "message": "Request validation failed."}


def test_missing_hash_salt_is_an_explicit_internal_error(monkeypatch):
    monkeypatch.delenv("S14_HASH_SALT", raising=False)
    gateway = FakeGateway()
    app.dependency_overrides[get_gateway] = lambda: gateway

    response = TestClient(app).post(
        "/records",
        json={"sb_number": "SB-42", "port_code": "INMAA1", "sb_date": "2026-10-20"},
    )

    assert response.status_code == 500
    assert response.json() == {"code": "INTERNAL", "message": "S14_HASH_SALT is not configured."}
    assert gateway.calls == []


def test_customs_milestone_requires_customs_status():
    response = TestClient(app).post(
        f"/records/{'c' * 64}/milestones",
        json={
            "milestone": "CUSTOMS_STATUS_OBSERVED",
            "occurred_on": "2026-10-19",
            "acting_as": "EXPORTERS_BODY",
        },
    )

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION"


def test_customs_status_is_preserved_in_milestone_payload(monkeypatch):
    monkeypatch.setenv("S14_HASH_SALT", "test-salt")
    gateway = FakeGateway()
    app.dependency_overrides[get_gateway] = lambda: gateway
    sb_hash = "d" * 64

    response = TestClient(app).post(
        f"/records/{sb_hash}/milestones",
        json={
            "milestone": "CUSTOMS_STATUS_OBSERVED",
            "occurred_on": "2026-10-19",
            "acting_as": "EXPORTERS_BODY",
            "customs_status": CustomsStatus.PENDING.value,
        },
    )

    assert response.status_code == 200
    assert json.loads(gateway.calls[0].args[0]) == {
        "sb_hash": sb_hash,
        "milestone": Milestone.CUSTOMS_STATUS_OBSERVED.value,
        "occurred_on": "2026-10-19",
        "customs_status": CustomsStatus.PENDING.value,
    }


def test_list_records_returns_records_with_assessments():
    records = [
        record(
            event(Milestone.DOCS_ACKNOWLEDGED, day=1),
            customs(CustomsStatus.PENDING, day=2),
        )
    ]

    class RecordsGateway(FakeGateway):
        def evaluate(self, request: GatewayRequest) -> GatewayResult:
            self.calls.append(request)
            return GatewayResult(
                ok=True,
                payload=[item.model_dump(mode="json") for item in records],
            )

    gateway = RecordsGateway()
    app.dependency_overrides[get_gateway] = lambda: gateway

    response = TestClient(app).get("/records")

    assert response.status_code == 200
    assert response.json()[0]["record"]["sb_hash"] == records[0].sb_hash
    assert response.json()[0]["assessment"]["bucket"] == "NO_PAYMENT_RECORDED"
    assert gateway.calls == [
        GatewayRequest(
            function=ChaincodeFunction.LIST_RECORDS,
            args=(),
            identity=OrgRole.AD_BANK,
        )
    ]


def test_metrics_returns_summary_for_gateway_records():
    records = [
        record(
            event(Milestone.DOCS_ACKNOWLEDGED, day=2, occurred_on=T0.date()),
            event(Milestone.PAYMENT_RECEIVED, day=3),
            event(Milestone.EDPMS_MARKED_OFF, day=5),
            customs(CustomsStatus.PENDING, day=6),
        )
    ]

    class RecordsGateway(FakeGateway):
        def evaluate(self, request: GatewayRequest) -> GatewayResult:
            self.calls.append(request)
            return GatewayResult(
                ok=True,
                payload=[item.model_dump(mode="json") for item in records],
            )

    gateway = RecordsGateway()
    app.dependency_overrides[get_gateway] = lambda: gateway

    response = TestClient(app).get("/metrics")

    assert response.status_code == 200
    assert response.json() == {
        "n_records": 1,
        "median_docs_handover_to_ack_days": 2.0,
        "median_payment_to_markoff_days": 2.0,
        "pending_total": 1,
        "pending_with_markoff": 1,
        "pending_with_markoff_share": 1.0,
    }
    assert gateway.calls == [
        GatewayRequest(
            function=ChaincodeFunction.LIST_RECORDS,
            args=(),
            identity=OrgRole.AD_BANK,
        )
    ]


@pytest.mark.parametrize("route", ["/records", "/metrics"])
def test_list_routes_return_gateway_error(route):
    class FailingGateway(FakeGateway):
        def evaluate(self, request: GatewayRequest) -> GatewayResult:
            self.calls.append(request)
            return GatewayResult(
                ok=False,
                error=ErrorBody(code=ErrorCode.LEDGER_UNAVAILABLE, message="ledger unavailable"),
            )

    gateway = FailingGateway()
    app.dependency_overrides[get_gateway] = lambda: gateway

    response = TestClient(app).get(route)

    assert response.status_code == 503
    assert response.json() == {
        "code": "LEDGER_UNAVAILABLE",
        "message": "ledger unavailable",
    }
    assert len(gateway.calls) == 1


@pytest.mark.parametrize("route", ["/records", "/metrics"])
def test_list_routes_return_internal_error_for_invalid_gateway_payload(route):
    class InvalidRecordsGateway(FakeGateway):
        def evaluate(self, request: GatewayRequest) -> GatewayResult:
            self.calls.append(request)
            return GatewayResult(ok=True, payload=[{"invalid": "record"}])

    app.dependency_overrides[get_gateway] = lambda: InvalidRecordsGateway()

    response = TestClient(app).get(route)

    assert response.status_code == 500
    assert response.json() == {
        "code": "INTERNAL",
        "message": "Gateway returned an invalid shipping-bill record list.",
    }
