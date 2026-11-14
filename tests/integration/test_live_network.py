"""End-to-end tests against a REAL Drunix test network. Owner: P1.

Skipped unless S14_LIVE=1 and the gateway is up (see network/README.md). Run on the
machine that hosts the network, at G2 and every gate after:

    S14_LIVE=1 uv run pytest tests/integration

They go through P3's gateway (GatewayRequest -> GatewayResult), so they check the
chaincode, the gateway and the network together. The client is in live_client.py.

The needs_g2 / needs_g3 strict-xfail markers (D-12) came off on 25 Oct 2026, when every
test passed on a real Drunix network (.github/workflows/live.yml, D-33).
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
import uuid
from datetime import date

import httpx
import pytest

from s14.contracts import (
    DEFAULT_MSP_ROLES,
    HASH_PATTERN,
    WRITER_ROLE,
    ChaincodeFunction,
    CustomsStatus,
    ErrorCode,
    GatewayResult,
    Milestone,
    MilestoneSubmission,
    OrgRole,
    ShippingBillRecord,
)
from s14.domain.hashing import canonical_sb_string, reference_hash, shipping_bill_hash
from tests.integration.live_client import LiveGateway, parse_payload, submission, synthetic_hash

live = pytest.mark.skipif(os.environ.get("S14_LIVE") != "1", reason="needs Drunix network (S14_LIVE=1)")


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
def test_both_orgs_read_the_same_record(gw: LiveGateway, sb_hash: str):
    assert gw.create_record(sb_hash).ok
    write(gw, sb_hash, Milestone.PAYMENT_RECEIVED)
    assert gw.get_record(sb_hash, OrgRole.AD_BANK) == gw.get_record(sb_hash, OrgRole.EXPORTERS_BODY)


@live
def test_get_unknown_record_is_not_found(gw: LiveGateway, sb_hash: str):
    result = gw.evaluate(ChaincodeFunction.GET_RECORD, [sb_hash], OrgRole.AD_BANK)
    assert_rejected(result, ErrorCode.NOT_FOUND)


# --------------------------------------------------------------------------- G3


@live
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
def test_list_records_includes_a_new_record(gw: LiveGateway, sb_hash: str):
    assert gw.create_record(sb_hash).ok
    assert sb_hash in {r.sb_hash for r in gw.list_records()}


@live
def test_list_records_returns_more_than_one_page(gw: LiveGateway):
    # ISS-p1-24: Drunix's SQL state DB stops an unpaginated range scan after 10 rows
    # (statesqldb.go GetStateRangeScanIterator), so ListRecords must page. 12 fresh records
    # plus whatever is already on the ledger is always more than 10.
    created = {synthetic_hash(f"page-{i}") for i in range(12)}
    for h in created:
        assert gw.create_record(h).ok
    listed = [r.sb_hash for r in gw.list_records()]
    assert created <= set(listed), f"missing {len(created - set(listed))} of 12; listed {len(listed)}"
    assert listed == sorted(listed) and len(listed) == len(set(listed))


@live
def test_no_raw_identifiers_on_the_ledger(gw: LiveGateway):
    # E9: the backend's hashing (s14.domain.hashing) turns known raw numbers into salted
    # hashes; only those reach the ledger. Raw values are synthetic and fresh per run.
    salt = os.environ.get("S14_HASH_SALT") or "s14-live-synthetic-test-salt"
    tag = uuid.uuid4().hex[:10].upper()
    sb_number, port_code, sb_date = f"SYNSB{tag}", "SYNPORT", date.today()
    raw_refs = {
        Milestone.DOCS_ACKNOWLEDGED: f"SYN-DOCS-{tag}",
        Milestone.PAYMENT_RECEIVED: f"SYN-IRM-{tag}",
        Milestone.EBRC_SELF_CERTIFIED: f"SYN-EBRC-{tag}",
    }
    sb_hash = shipping_bill_hash(sb_number, port_code, sb_date, salt)
    assert gw.create_record(sb_hash).ok
    for milestone, raw in raw_refs.items():
        sub = MilestoneSubmission(
            sb_hash=sb_hash, milestone=milestone, occurred_on=date.today(), reference_hash=reference_hash(raw, salt)
        )
        result = gw.record_milestone(sub, WRITER_ROLE[milestone])
        assert result.ok, result.error

    reads = [
        gw.evaluate(ChaincodeFunction.GET_RECORD, [sb_hash], OrgRole.AD_BANK),
        gw.evaluate(ChaincodeFunction.GET_RECORD, [sb_hash], OrgRole.EXPORTERS_BODY),
        gw.evaluate(ChaincodeFunction.LIST_RECORDS, [], OrgRole.AD_BANK),
    ]
    assert all(r.ok for r in reads), [r.error for r in reads]
    # Case-insensitive: every raw value has letters outside 0-9a-f, so a hash can't match by chance.
    ledger_json = " ".join(json.dumps(parse_payload(r.payload)) for r in reads).upper()
    for raw in [sb_number, canonical_sb_string(sb_number, port_code, sb_date), *raw_refs.values()]:
        assert raw.upper() not in ledger_json, f"raw value {raw!r} found on the ledger"

    record = ShippingBillRecord.model_validate(parse_payload(reads[0].payload))
    assert re.fullmatch(HASH_PATTERN, record.sb_hash)
    assert [e.milestone for e in record.events] == list(raw_refs)
    for event, raw in zip(record.events, raw_refs.values(), strict=True):
        assert event.reference_hash is not None and re.fullmatch(HASH_PATTERN, event.reference_hash)
        assert event.reference_hash == reference_hash(raw, salt)


# One rejected write per ErrorCode the chaincode raises. ENDORSEMENT_FAILED and
# LEDGER_UNAVAILABLE come from the network and the gateway, not the chaincode; the
# endorsement negative test is P3-G3-T1.


@live
def test_rejects_malformed_submission_validation(gw: LiveGateway, sb_hash: str):
    assert gw.create_record(sb_hash).ok
    no_reference = {"sb_hash": sb_hash, "milestone": Milestone.PAYMENT_RECEIVED, "occurred_on": str(date.today())}
    assert_rejected(gw.record_milestone(no_reference, OrgRole.AD_BANK), ErrorCode.VALIDATION)
    assert gw.get_record(sb_hash).events == ()


@live
def test_rejects_milestone_on_unknown_record_not_found(gw: LiveGateway, sb_hash: str):
    # [I] RecordMilestone on a missing record should fail NOT_FOUND, like GetRecord.
    result = gw.record_milestone(submission(sb_hash, Milestone.PAYMENT_RECEIVED), OrgRole.AD_BANK)
    assert_rejected(result, ErrorCode.NOT_FOUND)


@live
def test_rejects_second_create_already_exists(gw: LiveGateway, sb_hash: str):
    assert gw.create_record(sb_hash).ok
    assert_rejected(gw.create_record(sb_hash), ErrorCode.ALREADY_EXISTS)


@live
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
def test_rejects_ebrc_before_payment_precondition_failed(gw: LiveGateway, sb_hash: str):
    assert gw.create_record(sb_hash).ok
    result = gw.record_milestone(submission(sb_hash, Milestone.EBRC_SELF_CERTIFIED), OrgRole.EXPORTERS_BODY)
    assert_rejected(result, ErrorCode.PRECONDITION_FAILED)
    assert gw.get_record(sb_hash).events == ()


@live
def test_rejects_second_payment_duplicate_milestone(gw: LiveGateway, sb_hash: str):
    assert gw.create_record(sb_hash).ok
    write(gw, sb_hash, Milestone.PAYMENT_RECEIVED)
    result = gw.record_milestone(submission(sb_hash, Milestone.PAYMENT_RECEIVED), OrgRole.AD_BANK)
    assert_rejected(result, ErrorCode.DUPLICATE_MILESTONE)
    assert len(gw.get_record(sb_hash).events) == 1


# ------------------------------------------------------- 1.1.0: backend routes on the live network


def _salt() -> str:
    return os.environ.get("S14_HASH_SALT") or "s14-live-synthetic-test-salt"


@live
def test_reference_check_true_for_right_reference_false_for_wrong(gw: LiveGateway, backend_url: str, sb_hash: str):
    assert gw.create_record(sb_hash).ok
    raw = f"SYN-DOCS-{uuid.uuid4().hex[:10]}"
    sub = MilestoneSubmission(
        sb_hash=sb_hash,
        milestone=Milestone.DOCS_ACKNOWLEDGED,
        occurred_on=date.today(),
        reference_hash=reference_hash(raw, _salt()),
    )
    written = gw.record_milestone(sub, OrgRole.AD_BANK)
    assert written.ok, written.error

    url = f"{backend_url}/records/{sb_hash}/reference-check"
    good = httpx.post(url, json={"milestone": "DOCS_ACKNOWLEDGED", "reference": raw}, timeout=60)
    assert good.status_code == 200, good.text
    assert good.json()["recorded"] is True and good.json()["matches"] is True
    assert good.json()["tx_id"] == written.tx_id
    bad = httpx.post(url, json={"milestone": "DOCS_ACKNOWLEDGED", "reference": raw + "-x"}, timeout=60)
    assert bad.json()["recorded"] is True and bad.json()["matches"] is False
    absent = httpx.post(url, json={"milestone": "PAYMENT_RECEIVED", "reference": raw}, timeout=60)
    assert (absent.json()["recorded"], absent.json()["matches"]) == (False, False)


@live
def test_customs_import_records_existing_and_reports_unknown(gw: LiveGateway, backend_url: str):
    tag = uuid.uuid4().hex[:10].upper()
    today = date.today()
    known = (f"SYNSB{tag}", "SYNPORT")
    sb_hash = shipping_bill_hash(known[0], known[1], today, _salt())
    assert gw.create_record(sb_hash).ok

    def row(number: str) -> dict:
        return {
            "sb_number": number,
            "port_code": "SYNPORT",
            "sb_date": str(today),
            "customs_status": "PENDING",
            "observed_on": str(today),
        }

    response = httpx.post(
        f"{backend_url}/customs/import", json={"rows": [row(known[0]), row(f"SYNUNKNOWN{tag}")]}, timeout=120
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["total"], body["recorded"], body["not_found"], body["failed"]) == (2, 1, 1, 0)
    assert body["rows"][0]["outcome"] == "RECORDED" and body["rows"][0]["sb_hash"] == sb_hash
    assert body["rows"][1]["outcome"] == "NOT_FOUND"

    timeline = httpx.get(f"{backend_url}/records/{sb_hash}", timeout=60).json()
    events = timeline["record"]["events"]
    assert [e["milestone"] for e in events] == ["CUSTOMS_STATUS_OBSERVED"]
    assert events[0]["tx_id"] == body["rows"][0]["tx_id"]


@live
def test_events_stream_delivers_milestone_recorded(gw: LiveGateway, backend_url: str, sb_hash: str):
    assert gw.create_record(sb_hash).ok
    received = threading.Event()
    opened = threading.Event()
    seen: list[str] = []
    stop = threading.Event()

    def reader() -> None:
        timeout = httpx.Timeout(10, read=40)  # bounded, so the thread can never hang (no replay: do not reconnect)
        deadline = time.time() + 40
        while not stop.is_set() and time.time() < deadline:
            try:
                with httpx.stream("GET", f"{backend_url}/events", timeout=timeout) as resp:
                    assert resp.status_code == 200
                    assert resp.headers["content-type"].startswith("text/event-stream")
                    opened.set()
                    for line in resp.iter_lines():
                        if stop.is_set() or time.time() > deadline:
                            return
                        if line.startswith("data:") and sb_hash in line:
                            seen.append(line)
                            received.set()
                            return
            except httpx.ReadTimeout:
                continue

    thread = threading.Thread(target=reader, daemon=True)
    thread.start()
    try:
        assert opened.wait(15), "GET /events did not open"
        write(gw, sb_hash, Milestone.DOCS_ACKNOWLEDGED)
        assert received.wait(30), "no MilestoneRecorded event for this sb_hash within 30 s"
    finally:
        stop.set()
        thread.join(timeout=10)
    event = json.loads(seen[0][len("data:") :].strip())
    assert event["name"] == "MilestoneRecorded"
    assert event["event"]["sb_hash"] == sb_hash
    assert event["event"]["milestone"] == "DOCS_ACKNOWLEDGED"
