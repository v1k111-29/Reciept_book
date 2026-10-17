"""SPEC for backend/s14/domain/metrics.py. Owner: P4. Delete the xfail marker when implemented."""

from __future__ import annotations

from datetime import timedelta

import pytest

from s14.contracts import CustomsStatus, Milestone
from s14.domain.metrics import summarise
from tests.factories import T0, customs, event, h, record

todo = pytest.mark.xfail(raises=NotImplementedError, strict=True, reason="P4 G3")
M = Milestone


@todo
def test_empty():
    s = summarise([])
    assert s.n_records == 0 and s.median_payment_to_markoff_days is None
    assert s.pending_with_markoff_share is None


@todo
def test_docs_handover_to_ack_median():
    # handed over on T0, acknowledged on ledger 2 and 6 days later -> median 4
    r1 = record(event(M.DOCS_ACKNOWLEDGED, day=2, occurred_on=T0.date()), sb_hash=h("a"))
    r2 = record(event(M.DOCS_ACKNOWLEDGED, day=6, occurred_on=T0.date()), sb_hash=h("b"))
    assert summarise([r1, r2]).median_docs_handover_to_ack_days == 4


@todo
def test_payment_to_markoff_days():
    paid_on = (T0 + timedelta(days=1)).date()
    r = record(event(M.DOCS_ACKNOWLEDGED, day=0), event(M.PAYMENT_RECEIVED, day=1, occurred_on=paid_on),
               event(M.EDPMS_MARKED_OFF, day=11))
    assert summarise([r]).median_payment_to_markoff_days == 10


@todo
def test_pending_with_markoff_share():
    with_markoff = record(event(M.DOCS_ACKNOWLEDGED, day=0), event(M.PAYMENT_RECEIVED, day=1),
                          event(M.EDPMS_MARKED_OFF, day=3), customs(CustomsStatus.PENDING, day=20,
                          sb_hash=h("x")), sb_hash=h("x"))
    without = record(event(M.PAYMENT_RECEIVED, day=1, sb_hash=h("y")),
                     customs(CustomsStatus.PENDING, day=20, sb_hash=h("y")), sb_hash=h("y"))
    resolved = record(customs(CustomsStatus.REALISED, day=20, sb_hash=h("z")), sb_hash=h("z"))
    s = summarise([with_markoff, without, resolved])
    assert (s.n_records, s.pending_total, s.pending_with_markoff) == (3, 2, 1)
    assert s.pending_with_markoff_share == 0.5
