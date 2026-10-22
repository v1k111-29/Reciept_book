"""The three pilot measures (docs/PROBLEM.md 6.6). Owner: P4.

  1. docs hand-over -> acknowledgement: DOCS_ACKNOWLEDGED.ledger_time.date() - its occurred_on
  2. payment -> mark-off: EDPMS_MARKED_OFF.ledger_time.date() - PAYMENT_RECEIVED.occurred_on
  3. share of records whose latest Customs status is PENDING that already have a mark-off
Medians over records that have the needed milestones; None when there are none.
"""

from __future__ import annotations

from collections.abc import Sequence
from statistics import median

from s14.contracts import CustomsStatus, MetricsSummary, Milestone, ShippingBillRecord


def summarise(records: Sequence[ShippingBillRecord]) -> MetricsSummary:
    """Spec: tests/backend/test_metrics_spec.py"""
    docs_handover_to_ack_days: list[int] = []
    payment_to_markoff_days: list[int] = []
    pending_total = 0
    pending_with_markoff = 0

    for record in records:
        events_by_milestone = {event.milestone: event for event in record.events}
        docs_acknowledged = events_by_milestone.get(Milestone.DOCS_ACKNOWLEDGED)
        if docs_acknowledged is not None:
            docs_handover_to_ack_days.append(
                (docs_acknowledged.ledger_time.date() - docs_acknowledged.occurred_on).days
            )

        payment_received = events_by_milestone.get(Milestone.PAYMENT_RECEIVED)
        edpms_marked_off = events_by_milestone.get(Milestone.EDPMS_MARKED_OFF)
        if payment_received is not None and edpms_marked_off is not None:
            payment_to_markoff_days.append(
                (edpms_marked_off.ledger_time.date() - payment_received.occurred_on).days
            )

        customs_events = (
            event
            for event in record.events
            if event.milestone is Milestone.CUSTOMS_STATUS_OBSERVED
        )
        latest_customs = max(customs_events, key=lambda event: event.ledger_time, default=None)
        if latest_customs is not None and latest_customs.customs_status is CustomsStatus.PENDING:
            pending_total += 1
            if edpms_marked_off is not None:
                pending_with_markoff += 1

    return MetricsSummary(
        n_records=len(records),
        median_docs_handover_to_ack_days=(
            median(docs_handover_to_ack_days) if docs_handover_to_ack_days else None
        ),
        median_payment_to_markoff_days=(
            median(payment_to_markoff_days) if payment_to_markoff_days else None
        ),
        pending_total=pending_total,
        pending_with_markoff=pending_with_markoff,
        pending_with_markoff_share=(
            pending_with_markoff / pending_total if pending_total else None
        ),
    )
