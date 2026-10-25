"""Demo seed set: ~30 synthetic shipping bills across all five cause buckets. Owner: P4.

Every record is labelled synthetic (AGENTS.md section 8). `load_records` writes through the
backend HTTP API, so hashing, role routing and chaincode rules all run for real.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable, Iterator
from datetime import date, timedelta

from s14.contracts import (
    CauseBucket,
    CreateRecordRequest,
    CustomsStatus,
    Milestone,
    MilestoneRequest,
    OrgRole,
)
from s14.seed import SYNTHETIC_DATA_LABEL, SeedRecord

_START_DATE = date(2026, 8, 1)
DEFAULT_COUNT = 30

# bucket -> milestones recorded, in order. The last Customs observation decides the bucket
# (docs/PROBLEM.md 4.3, backend/s14/domain/assessment.py).
_SCENARIOS: dict[CauseBucket, tuple[Milestone, ...]] = {
    CauseBucket.CONSISTENT: (
        Milestone.DOCS_ACKNOWLEDGED,
        Milestone.PAYMENT_RECEIVED,
        Milestone.EDPMS_MARKED_OFF,
        Milestone.EBRC_SELF_CERTIFIED,
        Milestone.CUSTOMS_STATUS_OBSERVED,  # REALISED
    ),
    CauseBucket.NO_PAYMENT_RECORDED: (Milestone.DOCS_ACKNOWLEDGED, Milestone.CUSTOMS_STATUS_OBSERVED),
    CauseBucket.EXPORTER_LINKAGE_MISSING: (Milestone.PAYMENT_RECEIVED, Milestone.CUSTOMS_STATUS_OBSERVED),
    CauseBucket.BANK_NOT_MARKED_OFF: (
        Milestone.DOCS_ACKNOWLEDGED,
        Milestone.PAYMENT_RECEIVED,
        Milestone.CUSTOMS_STATUS_OBSERVED,
    ),
    CauseBucket.DOWNSTREAM_SYNC: (
        Milestone.DOCS_ACKNOWLEDGED,
        Milestone.PAYMENT_RECEIVED,
        Milestone.EDPMS_MARKED_OFF,
        Milestone.CUSTOMS_STATUS_OBSERVED,
    ),
}
_BUCKETS = tuple(_SCENARIOS)
_BANK = {Milestone.DOCS_ACKNOWLEDGED, Milestone.PAYMENT_RECEIVED, Milestone.EDPMS_MARKED_OFF}
_NEEDS_REFERENCE = {Milestone.DOCS_ACKNOWLEDGED, Milestone.PAYMENT_RECEIVED, Milestone.EBRC_SELF_CERTIFIED}


def bucket_of(index: int) -> CauseBucket:
    """Bucket of the 1-based record `index`: buckets rotate, so 30 records give 6 of each."""
    return _BUCKETS[(index - 1) % len(_BUCKETS)]


def generate_demo_records(count: int = DEFAULT_COUNT) -> Iterator[SeedRecord]:
    if count < 0:
        raise ValueError("count must be non-negative")
    for index in range(1, count + 1):
        bucket = bucket_of(index)
        sb_date = _START_DATE + timedelta(days=index)
        ident = f"{index:04d}"
        requests = []
        for step, milestone in enumerate(_SCENARIOS[bucket]):
            occurred_on = sb_date + timedelta(days=1 + step + index % 3)
            is_customs = milestone is Milestone.CUSTOMS_STATUS_OBSERVED
            requests.append(
                MilestoneRequest(
                    milestone=milestone,
                    occurred_on=occurred_on,
                    acting_as=OrgRole.AD_BANK if milestone in _BANK else OrgRole.EXPORTERS_BODY,
                    reference=f"SYNTHETIC-{milestone.value}-{ident}" if milestone in _NEEDS_REFERENCE else None,
                    customs_status=(
                        (CustomsStatus.REALISED if bucket is CauseBucket.CONSISTENT else CustomsStatus.PENDING)
                        if is_customs
                        else None
                    ),
                )
            )
        yield SeedRecord(
            label=SYNTHETIC_DATA_LABEL,
            create_request=CreateRecordRequest(
                sb_number=f"SYNTHETIC-SB-{ident}", port_code="INMAA1", sb_date=sb_date
            ),
            milestone_requests=tuple(requests),
        )


def expected_buckets(count: int = DEFAULT_COUNT) -> Counter[CauseBucket]:
    return Counter(bucket_of(i) for i in range(1, count + 1))


# post(path, json) -> (status_code, body). Injected so tests need no network.
Post = Callable[[str, dict[str, object]], tuple[int, dict[str, object]]]


def load_records(post: Post, count: int = DEFAULT_COUNT) -> tuple[int, list[str]]:
    """Write `count` demo records. Returns (records fully loaded, error lines)."""
    loaded = 0
    errors: list[str] = []
    for record in generate_demo_records(count):
        ident = record.create_request.sb_number
        status, body = post("/records", record.create_request.model_dump(mode="json"))
        if status != 200:
            errors.append(f"{ident}: create -> {status} {body}")
            continue
        sb_hash = str(body["sb_hash"])
        ok = True
        for req in record.milestone_requests:
            status, body = post(f"/records/{sb_hash}/milestones", req.model_dump(mode="json", exclude_none=True))
            if status != 200:
                errors.append(f"{ident}: {req.milestone.value} -> {status} {body}")
                ok = False
                break
        loaded += ok
    return loaded, errors
