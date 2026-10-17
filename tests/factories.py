"""Test factories shared by all Python tests. Owner: P1 (changes only with contracts.py)."""

from __future__ import annotations

import hashlib
from datetime import date, datetime, timedelta, timezone

from s14.contracts import (
    DEFAULT_MSP_ROLES,
    CustomsStatus,
    Milestone,
    MilestoneEvent,
    OrgRole,
    ShippingBillRecord,
)

T0 = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)
BANK_MSP = "Org1MSP"
BODY_MSP = "Org2MSP"


def h(text: str) -> str:
    """Deterministic fake hash for tests (not the production salted hash)."""
    return hashlib.sha256(text.encode()).hexdigest()


SB = h("test-shipping-bill-1")


def event(
    milestone: Milestone,
    *,
    day: int,
    occurred_on: date | None = None,
    customs_status: CustomsStatus | None = None,
    sb_hash: str = SB,
) -> MilestoneEvent:
    """An event whose ledger_time is T0 + `day` days."""
    msp = BANK_MSP if milestone in {
        Milestone.DOCS_ACKNOWLEDGED, Milestone.PAYMENT_RECEIVED, Milestone.EDPMS_MARKED_OFF
    } else BODY_MSP
    ledger_time = T0 + timedelta(days=day)
    needs_ref = milestone in {
        Milestone.DOCS_ACKNOWLEDGED, Milestone.PAYMENT_RECEIVED, Milestone.EBRC_SELF_CERTIFIED
    }
    return MilestoneEvent(
        sb_hash=sb_hash,
        milestone=milestone,
        occurred_on=occurred_on or ledger_time.date(),
        reference_hash=h(f"ref-{milestone}-{day}") if needs_ref else None,
        customs_status=customs_status,
        tx_id=f"tx-{milestone}-{day}",
        ledger_time=ledger_time,
        submitter_msp=msp,
        submitter_role=DEFAULT_MSP_ROLES[msp],
    )


def record(*events: MilestoneEvent, sb_hash: str = SB) -> ShippingBillRecord:
    return ShippingBillRecord(
        sb_hash=sb_hash, bank_msp=BANK_MSP, created_ledger_time=T0, events=tuple(events)
    )


def customs(status: CustomsStatus, *, day: int, sb_hash: str = SB) -> MilestoneEvent:
    return event(Milestone.CUSTOMS_STATUS_OBSERVED, day=day, customs_status=status, sb_hash=sb_hash)


__all__ = ["T0", "SB", "BANK_MSP", "BODY_MSP", "h", "event", "record", "customs", "OrgRole"]
