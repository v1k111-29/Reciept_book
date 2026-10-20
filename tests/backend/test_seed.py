from __future__ import annotations

from s14.contracts import CreateRecordRequest, Milestone, MilestoneRequest
from s14.seed import SYNTHETIC_DATA_LABEL, SeedRecord, generate_seed_records


def test_generator_yields_labeled_synthetic_contract_requests() -> None:
    records = tuple(generate_seed_records(count=2))

    assert len(records) == 2
    assert all(isinstance(record, SeedRecord) for record in records)
    assert all(record.label == SYNTHETIC_DATA_LABEL for record in records)
    assert all(record.label == "synthetic demo data" for record in records)
    assert all(isinstance(record.create_request, CreateRecordRequest) for record in records)
    assert all(
        all(isinstance(request, MilestoneRequest) for request in record.milestone_requests)
        for record in records
    )
    assert records[0].create_request.sb_number == "SYNTHETIC-SB-0001"
    assert records[1].create_request.sb_number == "SYNTHETIC-SB-0002"
    assert tuple(request.milestone for request in records[0].milestone_requests) == (
        Milestone.DOCS_ACKNOWLEDGED,
        Milestone.PAYMENT_RECEIVED,
    )


def test_generator_allows_zero_records() -> None:
    assert tuple(generate_seed_records(count=0)) == ()
