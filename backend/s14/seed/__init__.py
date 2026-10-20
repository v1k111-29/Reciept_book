"""Labeled synthetic seed records for demos and development."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date, timedelta

from s14.contracts import CreateRecordRequest, Milestone, MilestoneRequest, OrgRole

SYNTHETIC_DATA_LABEL = "synthetic demo data"
_START_DATE = date(2026, 1, 1)


@dataclass(frozen=True)
class SeedRecord:
    label: str
    create_request: CreateRecordRequest
    milestone_requests: tuple[MilestoneRequest, ...]


def generate_seed_records(count: int = 1) -> Iterator[SeedRecord]:
    """Yield deterministic, explicitly labeled synthetic requests."""
    if count < 0:
        raise ValueError("count must be non-negative")

    for index in range(1, count + 1):
        occurred_on = _START_DATE + timedelta(days=index - 1)
        identifier = f"{index:04d}"
        yield SeedRecord(
            label=SYNTHETIC_DATA_LABEL,
            create_request=CreateRecordRequest(
                sb_number=f"SYNTHETIC-SB-{identifier}",
                port_code="INMAA1",
                sb_date=occurred_on,
            ),
            milestone_requests=(
                MilestoneRequest(
                    milestone=Milestone.DOCS_ACKNOWLEDGED,
                    occurred_on=occurred_on,
                    acting_as=OrgRole.AD_BANK,
                    reference=f"SYNTHETIC-DOCS-{identifier}",
                ),
                MilestoneRequest(
                    milestone=Milestone.PAYMENT_RECEIVED,
                    occurred_on=occurred_on,
                    acting_as=OrgRole.AD_BANK,
                    reference=f"SYNTHETIC-IRM-{identifier}",
                ),
            ),
        )


__all__ = ["SYNTHETIC_DATA_LABEL", "SeedRecord", "generate_seed_records"]
