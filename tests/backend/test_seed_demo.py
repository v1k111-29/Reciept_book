from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from s14 import api
from s14.contracts import (
    PRECONDITIONS,
    REFERENCE_REQUIRED,
    WRITER_ROLE,
    CauseBucket,
    ChaincodeFunction,
    GatewayRequest,
    GatewayResult,
    Milestone,
    MilestoneEvent,
    MilestoneSubmission,
    OrgRole,
    ShippingBillRecord,
    TimelineView,
)
from s14.seed import SYNTHETIC_DATA_LABEL
from s14.seed.demo import DEFAULT_COUNT, expected_buckets, generate_demo_records, load_records
from tests.backend.fakes import FakeGateway

NOW = datetime(2026, 10, 1, tzinfo=timezone.utc)


class LedgerGateway(FakeGateway):
    """Test double that keeps records, so list/assess work end to end."""

    def __init__(self) -> None:
        super().__init__()
        self.records: dict[str, ShippingBillRecord] = {}

    def submit(self, request: GatewayRequest) -> GatewayResult:
        result = super().submit(request)
        when = NOW + timedelta(minutes=len(self.calls))
        if request.function is ChaincodeFunction.CREATE_RECORD:
            self.records[request.args[0]] = ShippingBillRecord(
                sb_hash=request.args[0], bank_msp="Org1MSP", created_ledger_time=when, events=()
            )
        else:
            sub = MilestoneSubmission.model_validate_json(request.args[0])
            old = self.records[sub.sb_hash]
            event = MilestoneEvent(
                **sub.model_dump(),
                tx_id=result.tx_id,
                ledger_time=when,
                submitter_msp="Org1MSP" if WRITER_ROLE[sub.milestone] is OrgRole.AD_BANK else "Org2MSP",
                submitter_role=WRITER_ROLE[sub.milestone],
            )
            self.records[sub.sb_hash] = old.model_copy(update={"events": (*old.events, event)})
        return result

    def evaluate(self, request: GatewayRequest) -> GatewayResult:
        return GatewayResult(ok=True, payload=[r.model_dump(mode="json") for r in self.records.values()])


def test_demo_set_covers_all_five_buckets_and_is_labelled() -> None:
    records = list(generate_demo_records())
    assert len(records) == DEFAULT_COUNT == 30
    assert all(r.label == SYNTHETIC_DATA_LABEL for r in records)
    assert all(r.create_request.sb_number.startswith("SYNTHETIC-") for r in records)
    assert set(expected_buckets()) == set(CauseBucket)


def test_demo_milestones_respect_writer_roles_preconditions_and_references() -> None:
    for record in generate_demo_records():
        seen: set[Milestone] = set()
        for req in record.milestone_requests:
            assert WRITER_ROLE[req.milestone] == req.acting_as
            assert set(PRECONDITIONS[req.milestone]) <= seen
            assert (req.reference is not None) == (req.milestone in REFERENCE_REQUIRED)
            seen.add(req.milestone)


def test_loading_through_the_api_gives_the_expected_cause_buckets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("S14_HASH_SALT", "test-salt")
    gateway = LedgerGateway()
    api.app.dependency_overrides[api.get_gateway] = lambda: gateway
    try:
        client = TestClient(api.app)

        def post(path: str, body: dict[str, object]):
            response = client.post(path, json=body)
            return response.status_code, response.json()

        loaded, errors = load_records(post)
        assert errors == []
        assert loaded == DEFAULT_COUNT
        views = [TimelineView.model_validate(v) for v in client.get("/records").json()]
    finally:
        api.app.dependency_overrides.clear()
    counts = {b: sum(v.assessment.bucket == b for v in views) for b in CauseBucket}
    assert counts == dict(expected_buckets())
