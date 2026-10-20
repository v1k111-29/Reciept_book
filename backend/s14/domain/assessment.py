"""Cause assessment for a shipping bill. Owner: P4.

Implements the heuristic in docs/PROBLEM.md 4.3 and contracts.CauseBucket [I]:
  1. latest CUSTOMS_STATUS_OBSERVED is not PENDING (or there is none) -> CONSISTENT
  2. no PAYMENT_RECEIVED                                              -> NO_PAYMENT_RECORDED
  3. EDPMS_MARKED_OFF present                                         -> DOWNSTREAM_SYNC
  4. DOCS_ACKNOWLEDGED missing                                        -> EXPORTER_LINKAGE_MISSING
  5. otherwise                                                        -> BANK_NOT_MARKED_OFF
"Latest" means the observation with the greatest ledger_time.
`missing` lists the non-repeatable milestones not yet on the record, in contract order.
"""

from __future__ import annotations

from s14.contracts import (
    REPEATABLE,
    CauseAssessment,
    CauseBucket,
    CustomsStatus,
    Milestone,
    ShippingBillRecord,
)


def assess(record: ShippingBillRecord) -> CauseAssessment:
    events = record.events
    present = {event.milestone for event in events}
    missing = tuple(
        milestone
        for milestone in Milestone
        if milestone not in REPEATABLE and milestone not in present
    )
    customs_events = [event for event in events if event.milestone is Milestone.CUSTOMS_STATUS_OBSERVED]
    latest_customs = max(customs_events, key=lambda event: event.ledger_time, default=None)

    if latest_customs is None or latest_customs.customs_status is not CustomsStatus.PENDING:
        bucket = CauseBucket.CONSISTENT
        explanation = "No pending Customs observation is recorded."
    elif Milestone.PAYMENT_RECEIVED not in present:
        bucket = CauseBucket.NO_PAYMENT_RECORDED
        explanation = "Customs is pending and no payment milestone is recorded."
    elif Milestone.EDPMS_MARKED_OFF in present:
        bucket = CauseBucket.DOWNSTREAM_SYNC
        explanation = "Customs is pending even though the bank recorded an EDPMS mark-off."
    elif Milestone.DOCS_ACKNOWLEDGED not in present:
        bucket = CauseBucket.EXPORTER_LINKAGE_MISSING
        explanation = "Customs is pending and the bank has not acknowledged the documents."
    else:
        bucket = CauseBucket.BANK_NOT_MARKED_OFF
        explanation = "Customs is pending and the bank has not recorded an EDPMS mark-off."

    return CauseAssessment(bucket=bucket, missing=missing, explanation=explanation)
