"""SPEC for backend/s14/domain/assessment.py. Owner: P4. Delete the xfail marker when implemented."""

from __future__ import annotations

import pytest

from s14.contracts import CauseBucket, CustomsStatus, Milestone
from s14.domain.assessment import assess
from tests.factories import customs, event, record

todo = pytest.mark.xfail(raises=NotImplementedError, strict=True, reason="P4 G3")
M = Milestone


@todo
def test_no_customs_observation_is_consistent():
    assert assess(record(event(M.PAYMENT_RECEIVED, day=1))).bucket is CauseBucket.CONSISTENT


@todo
def test_latest_realised_is_consistent():
    r = record(customs(CustomsStatus.PENDING, day=1), customs(CustomsStatus.REALISED, day=5))
    assert assess(r).bucket is CauseBucket.CONSISTENT


@todo
def test_pending_without_payment():
    r = record(event(M.DOCS_ACKNOWLEDGED, day=0), customs(CustomsStatus.PENDING, day=3))
    assert assess(r).bucket is CauseBucket.NO_PAYMENT_RECORDED


@todo
def test_pending_with_markoff_is_downstream_sync():  # the CAG Para 5.1 pattern
    r = record(event(M.DOCS_ACKNOWLEDGED, day=0), event(M.PAYMENT_RECEIVED, day=2),
               event(M.EDPMS_MARKED_OFF, day=4), customs(CustomsStatus.PENDING, day=30))
    a = assess(r)
    assert a.bucket is CauseBucket.DOWNSTREAM_SYNC
    assert a.missing == (M.EBRC_SELF_CERTIFIED,)


@todo
def test_pending_with_payment_but_no_docs_ack():
    r = record(event(M.PAYMENT_RECEIVED, day=2), customs(CustomsStatus.PENDING, day=30))
    assert assess(r).bucket is CauseBucket.EXPORTER_LINKAGE_MISSING


@todo
def test_pending_bank_not_marked_off():
    r = record(event(M.DOCS_ACKNOWLEDGED, day=0), event(M.PAYMENT_RECEIVED, day=2),
               event(M.EBRC_SELF_CERTIFIED, day=3), customs(CustomsStatus.PENDING, day=30))
    a = assess(r)
    assert a.bucket is CauseBucket.BANK_NOT_MARKED_OFF
    assert a.missing == (M.EDPMS_MARKED_OFF,)


@todo
def test_latest_is_by_ledger_time_not_list_order():
    r = record(customs(CustomsStatus.REALISED, day=9), customs(CustomsStatus.PENDING, day=2))
    assert assess(r).bucket is CauseBucket.CONSISTENT
