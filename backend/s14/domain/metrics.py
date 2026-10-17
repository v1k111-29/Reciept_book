"""The three pilot measures (docs/PROBLEM.md 6.6). Owner: P4.

  1. docs hand-over -> acknowledgement: DOCS_ACKNOWLEDGED.ledger_time.date() - its occurred_on
  2. payment -> mark-off: EDPMS_MARKED_OFF.ledger_time.date() - PAYMENT_RECEIVED.occurred_on
  3. share of records whose latest Customs status is PENDING that already have a mark-off
Medians over records that have the needed milestones; None when there are none.
"""

from __future__ import annotations

from collections.abc import Sequence

from s14.contracts import MetricsSummary, ShippingBillRecord


def summarise(records: Sequence[ShippingBillRecord]) -> MetricsSummary:
    """Spec: tests/backend/test_metrics_spec.py"""
    raise NotImplementedError("P4: implement in G3")
