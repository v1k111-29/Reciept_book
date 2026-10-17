"""Contract rules. Owner: P1. These must stay green; they describe contracts.py itself."""

from __future__ import annotations

from datetime import date

import pytest
from pydantic import ValidationError

from s14 import contracts as c
from tests.factories import SB, h


def sub(**kw):
    base = dict(sb_hash=SB, milestone=c.Milestone.PAYMENT_RECEIVED, occurred_on=date(2026, 11, 1),
                reference_hash=h("irm"))
    base.update(kw)
    return c.MilestoneSubmission(**base)


def test_every_milestone_has_writer_and_preconditions():
    assert set(c.WRITER_ROLE) == set(c.Milestone)
    assert set(c.PRECONDITIONS) == set(c.Milestone)


def test_preconditions_never_point_at_repeatable_or_self():
    for m, pre in c.PRECONDITIONS.items():
        assert m not in pre
        assert not (set(pre) & c.REPEATABLE)


def test_ebrc_needs_payment_first():  # DGFT FAQ Q30 [P]
    assert c.Milestone.PAYMENT_RECEIVED in c.PRECONDITIONS[c.Milestone.EBRC_SELF_CERTIFIED]


def test_markoff_needs_docs_and_payment():  # Reg 18(1)(g) [P]
    assert set(c.PRECONDITIONS[c.Milestone.EDPMS_MARKED_OFF]) == {
        c.Milestone.DOCS_ACKNOWLEDGED, c.Milestone.PAYMENT_RECEIVED}


def test_only_bank_marks_off():
    assert c.WRITER_ROLE[c.Milestone.EDPMS_MARKED_OFF] is c.OrgRole.AD_BANK


def test_valid_submission_accepted():
    assert sub().milestone is c.Milestone.PAYMENT_RECEIVED


def test_bad_hash_rejected():
    with pytest.raises(ValidationError):
        sub(sb_hash="not-a-hash")


def test_customs_status_required_for_customs_milestone():
    with pytest.raises(ValidationError):
        sub(milestone=c.Milestone.CUSTOMS_STATUS_OBSERVED, reference_hash=None)
    ok = sub(milestone=c.Milestone.CUSTOMS_STATUS_OBSERVED, reference_hash=None,
             customs_status=c.CustomsStatus.PENDING)
    assert ok.customs_status is c.CustomsStatus.PENDING


def test_customs_status_forbidden_elsewhere():
    with pytest.raises(ValidationError):
        sub(customs_status=c.CustomsStatus.REALISED)


def test_reference_required_milestones():
    for m in c.REFERENCE_REQUIRED:
        with pytest.raises(ValidationError):
            sub(milestone=m, reference_hash=None)


def test_extra_fields_rejected():
    with pytest.raises(ValidationError):
        sub(amount_inr=100)  # amounts never travel in a submission (private data is N1)


def test_gateway_result_consistency():
    assert c.GatewayResult(ok=True, tx_id="t1").ok
    with pytest.raises(ValidationError):
        c.GatewayResult(ok=False)
    with pytest.raises(ValidationError):
        c.GatewayResult(ok=True, error=c.ErrorBody(code=c.ErrorCode.VALIDATION, message="x"))


def test_default_msps_cover_both_writer_roles():
    assert {c.OrgRole.AD_BANK, c.OrgRole.EXPORTERS_BODY} <= set(c.DEFAULT_MSP_ROLES.values())


def mreq(**kw):
    base = dict(milestone=c.Milestone.PAYMENT_RECEIVED, occurred_on=date(2026, 11, 1),
                acting_as=c.OrgRole.AD_BANK, reference="IRM-123")
    base.update(kw)
    return c.MilestoneRequest(**base)


def test_milestone_request_carries_raw_reference():
    assert mreq().reference == "IRM-123"


def test_milestone_request_rules_match_submission_rules():
    with pytest.raises(ValidationError):
        mreq(reference=None)  # PAYMENT_RECEIVED needs a reference
    with pytest.raises(ValidationError):
        mreq(milestone=c.Milestone.CUSTOMS_STATUS_OBSERVED, reference=None)  # needs customs_status
    with pytest.raises(ValidationError):
        mreq(customs_status=c.CustomsStatus.PENDING)  # not allowed on PAYMENT_RECEIVED
