"""End-to-end tests against a REAL Drunix test network. Owner: P1.

Skipped unless S14_LIVE=1 and the gateway is up (see network/README.md). Run on the
machine that hosts the network, at G2 and every gate after:

    S14_LIVE=1 uv run pytest tests/integration

They go through P3's gateway (GatewayRequest -> GatewayResult), so they check the
chaincode, the gateway and the network together. The client is in live_client.py.

Tests marked xfail(strict) describe work that is not deployed yet. When one starts passing
it turns red on purpose: remove its marker in the same commit (decision D-12).
"""

from __future__ import annotations

import os
from datetime import date

import pytest

from s14.contracts import (
    DEFAULT_MSP_ROLES,
    WRITER_ROLE,
    ChaincodeFunction,
    CustomsStatus,
    ErrorCode,
    GatewayResult,
    Milestone,
    OrgRole,
)
from tests.integration.live_client import LiveGateway, submission

live = pytest.mark.skipif(os.environ.get("S14_LIVE") != "1", reason="needs Drunix network (S14_LIVE=1)")
needs_g2 = pytest.mark.xfail(
    strict=True, reason="P1-G2-T1: needs P2-G2-T1 + P3-G2-T1 deployed; remove marker when it passes"
)
needs_g3 = pytest.mark.xfail(
    strict=True, reason="P1-G3-T1: needs P2-G3-T1 deployed; remove marker when it passes"
)


def msp_of(role: OrgRole) -> str:
    """MSP id the gateway signs with for `role` (gateway env S14_<ROLE>_MSP_ID)."""
    default = next(msp for msp, r in DEFAULT_MSP_ROLES.items() if r == role)
    return os.environ.get(f"S14_{role}_MSP_ID", default)


def write(gw: LiveGateway, sb_hash: str, milestone: Milestone, status: CustomsStatus | None = None) -> GatewayResult:
    """Record `milestone` as the role WRITER_ROLE allows; fail the test if rejected."""
    result = gw.record_milestone(submission(sb_hash, milestone, customs_status=status), WRITER_ROLE[milestone])
    assert result.ok, result.error
    return result


def assert_rejected(result: GatewayResult, code: ErrorCode) -> None:
    assert not result.ok, f"expected {code}, write was accepted (tx {result.tx_id})"
    assert result.error is not None and result.error.code == code, result.error


# --------------------------------------------------------------------------- G0


@live
def test_gateway_health(gw: LiveGateway):
    assert gw.http.get("/health").status_code == 200


# --------------------------------------------------------------------------- G2


@live
@needs_g2
def test_create_record_and_payment_milestone_roundtrip(gw: LiveGateway, sb_hash: str):
    created = gw.create_record(sb_hash, OrgRole.AD_BANK)
    assert created.ok, created.error
    assert created.tx_id

    sub = submission(sb_hash, Milestone.PAYMENT_RECEIVED)
    written = gw.record_milestone(sub, OrgRole.AD_BANK)
    assert written.ok, written.error

    record = gw.get_record(sb_hash)
    assert record.sb_hash == sb_hash
    assert record.bank_msp == msp_of(OrgRole.AD_BANK)
    (event,) = record.events
    assert event.milestone == Milestone.PAYMENT_RECEIVED
    assert event.reference_hash == sub.reference_hash
    assert event.occurred_on == sub.occurred_on
    assert event.tx_id == written.tx_id
    assert event.submitter_msp == msp_of(OrgRole.AD_BANK)
    assert event.submitter_role == OrgRole.AD_BANK
    assert event.ledger_time >= record.created_ledger_time


@live
@needs_g2
def test_both_orgs_read_the_same_record(gw: LiveGateway, sb_hash: str):
    assert gw.create_record(sb_hash).ok
    write(gw, sb_hash, Milestone.PAYMENT_RECEIVED)
    assert gw.get_record(sb_hash, OrgRole.AD_BANK) == gw.get_record(sb_hash, OrgRole.EXPORTERS_BODY)


@live
@needs_g2
def test_get_unknown_record_is_not_found(gw: LiveGateway, sb_hash: str):
    result = gw.evaluate(ChaincodeFunction.GET_RECORD, [sb_hash], OrgRole.AD_BANK)
    assert_rejected(result, ErrorCode.NOT_FOUND)


# --------------------------------------------------------------------------- G3


@live
@needs_g3
def test_all_five_milestones_in_order(gw: LiveGateway, sb_hash: str):
    steps = [
        (Milestone.DOCS_ACKNOWLEDGED, None),
        (Milestone.PAYMENT_RECEIVED, None),
        (Milestone.EBRC_SELF_CERTIFIED, None),
        (Milestone.EDPMS_MARKED_OFF, None),
        (Milestone.CUSTOMS_STATUS_OBSERVED, CustomsStatus.PENDING),
        (Milestone.CUSTOMS_STATUS_OBSERVED, CustomsStatus.REALISED),  # repeatable
    ]
    assert gw.create_record(sb_hash).ok
    tx_ids = [write(gw, sb_hash, m, status).tx_id for m, status in steps]

    events = gw.get_record(sb_hash).events
    assert [(e.milestone, e.customs_status) for e in events] == steps
    assert [e.tx_id for e in events] == tx_ids
    assert len(set(tx_ids)) == len(tx_ids)
    for e in events:
        assert e.submitter_role == WRITER_ROLE[e.milestone]
        assert e.submitter_msp == msp_of(e.submitter_role)
    times = [e.ledger_time for e in events]
    assert times == sorted(times)


@live
@needs_g3
def test_list_records_includes_a_new_record(gw: LiveGateway, sb_hash: str):
    assert gw.create_record(sb_hash).ok
    assert sb_hash in {r.sb_hash for r in gw.list_records()}


# One rejected write per ErrorCode the chaincode raises. ENDORSEMENT_FAILED and
# LEDGER_UNAVAILABLE come from the network and the gateway, not the chaincode; the
# endorsement negative test is P3-G3-T1.


@live
@needs_g3
def test_rejects_malformed_submission_validation(gw: LiveGateway, sb_hash: str):
    assert gw.create_record(sb_hash).ok
    no_reference = {"sb_hash": sb_hash, "milestone": Milestone.PAYMENT_RECEIVED, "occurred_on": str(date.today())}
    assert_rejected(gw.record_milestone(no_reference, OrgRole.AD_BANK), ErrorCode.VALIDATION)
    assert gw.get_record(sb_hash).events == ()


@live
@needs_g3
def test_rejects_milestone_on_unknown_record_not_found(gw: LiveGateway, sb_hash: str):
    # [I] RecordMilestone on a missing record should fail NOT_FOUND, like GetRecord.
    result = gw.record_milestone(submission(sb_hash, Milestone.PAYMENT_RECEIVED), OrgRole.AD_BANK)
    assert_rejected(result, ErrorCode.NOT_FOUND)


@live
@needs_g3
def test_rejects_second_create_already_exists(gw: LiveGateway, sb_hash: str):
    assert gw.create_record(sb_hash).ok
    assert_rejected(gw.create_record(sb_hash), ErrorCode.ALREADY_EXISTS)


@live
@needs_g3
def test_rejects_payment_from_exporters_body_wrong_role(gw: LiveGateway, sb_hash: str):
    assert gw.create_record(sb_hash).ok
    result = gw.record_milestone(submission(sb_hash, Milestone.PAYMENT_RECEIVED), OrgRole.EXPORTERS_BODY)
    assert_rejected(result, ErrorCode.WRONG_ROLE)
    assert gw.get_record(sb_hash).events == ()


@live
@pytest.mark.skip(reason="WRONG_BANK needs a second AD_BANK org; the G1 network has one (Org3 is N2)")
def test_rejects_other_bank_wrong_bank(gw: LiveGateway, sb_hash: str):
    raise AssertionError("N2: create as bank A, write PAYMENT_RECEIVED as bank B, expect WRONG_BANK")


@live
@needs_g3
def test_rejects_ebrc_before_payment_precondition_failed(gw: LiveGateway, sb_hash: str):
    assert gw.create_record(sb_hash).ok
    result = gw.record_milestone(submission(sb_hash, Milestone.EBRC_SELF_CERTIFIED), OrgRole.EXPORTERS_BODY)
    assert_rejected(result, ErrorCode.PRECONDITION_FAILED)
    assert gw.get_record(sb_hash).events == ()


@live
@needs_g3
def test_rejects_second_payment_duplicate_milestone(gw: LiveGateway, sb_hash: str):
    assert gw.create_record(sb_hash).ok
    write(gw, sb_hash, Milestone.PAYMENT_RECEIVED)
    result = gw.record_milestone(submission(sb_hash, Milestone.PAYMENT_RECEIVED), OrgRole.AD_BANK)
    assert_rejected(result, ErrorCode.DUPLICATE_MILESTONE)
    assert len(gw.get_record(sb_hash).events) == 1
