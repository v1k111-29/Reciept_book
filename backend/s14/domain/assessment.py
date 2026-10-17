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

from s14.contracts import CauseAssessment, ShippingBillRecord


def assess(record: ShippingBillRecord) -> CauseAssessment:
    """Spec: tests/backend/test_assessment_spec.py"""
    raise NotImplementedError("P4: implement in G3")
