"""Client and helpers for the live Drunix tests. Owner: P1.

The tests talk to P3's gateway with contracts.GatewayRequest and read
contracts.GatewayResult back, so they check chaincode + gateway + network together,
without the backend. Every run uses fresh synthetic hashes, so tests never collide with
data already on the ledger.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import date
from typing import Any

import httpx

from s14.contracts import (
    GATEWAY_ROUTES,
    REFERENCE_REQUIRED,
    ChaincodeFunction,
    CustomsStatus,
    GatewayRequest,
    GatewayResult,
    Milestone,
    MilestoneSubmission,
    OrgRole,
    ShippingBillRecord,
)


def synthetic_hash(label: str) -> str:
    """A fresh 64-hex hash of synthetic data (never a real shipping-bill number)."""
    return hashlib.sha256(f"s14-live-synthetic-{label}-{uuid.uuid4()}".encode()).hexdigest()


def _path(route: str) -> str:
    return GATEWAY_ROUTES[route].split(" ", 1)[1]


class LiveGateway:
    """Minimal client for the gateway's /submit and /evaluate routes."""

    def __init__(self, base_url: str) -> None:
        self.http = httpx.Client(base_url=base_url, timeout=60)

    def _call(self, route: str, fn: ChaincodeFunction, args: list[str], identity: OrgRole) -> GatewayResult:
        req = GatewayRequest(function=fn, args=tuple(args), identity=identity)
        resp = self.http.post(_path(route), json=req.model_dump(mode="json"))
        return GatewayResult.model_validate(resp.json())

    def submit(self, fn: ChaincodeFunction, args: list[str], identity: OrgRole) -> GatewayResult:
        return self._call("submit", fn, args, identity)

    def evaluate(self, fn: ChaincodeFunction, args: list[str], identity: OrgRole) -> GatewayResult:
        return self._call("evaluate", fn, args, identity)

    # ---- chaincode transactions (argument shapes from chaincode/src/receiptBook.ts)

    def create_record(self, sb_hash: str, identity: OrgRole = OrgRole.AD_BANK) -> GatewayResult:
        return self.submit(ChaincodeFunction.CREATE_RECORD, [sb_hash], identity)

    def record_milestone(self, submission: MilestoneSubmission | dict[str, Any], identity: OrgRole) -> GatewayResult:
        body = submission if isinstance(submission, dict) else submission.model_dump(mode="json", exclude_none=True)
        return self.submit(ChaincodeFunction.RECORD_MILESTONE, [json.dumps(body)], identity)

    def get_record(self, sb_hash: str, identity: OrgRole = OrgRole.AD_BANK) -> ShippingBillRecord:
        result = self.evaluate(ChaincodeFunction.GET_RECORD, [sb_hash], identity)
        assert result.ok, result.error
        return ShippingBillRecord.model_validate(parse_payload(result.payload))

    def list_records(self, identity: OrgRole = OrgRole.AD_BANK) -> list[ShippingBillRecord]:
        result = self.evaluate(ChaincodeFunction.LIST_RECORDS, [], identity)
        assert result.ok, result.error
        return [ShippingBillRecord.model_validate(r) for r in parse_payload(result.payload)]


def parse_payload(payload: Any) -> Any:
    """GatewayResult.payload may arrive as parsed JSON or as the chaincode's JSON string.
    contracts.py does not fix which one yet (ISS-p1-7), so accept both."""
    return json.loads(payload) if isinstance(payload, (str, bytes)) else payload


def submission(
    sb_hash: str,
    milestone: Milestone,
    *,
    customs_status: CustomsStatus | None = None,
    occurred_on: date | None = None,
) -> MilestoneSubmission:
    """A valid submission for `milestone`, with a synthetic reference hash where required."""
    return MilestoneSubmission(
        sb_hash=sb_hash,
        milestone=milestone,
        occurred_on=occurred_on or date.today(),
        reference_hash=synthetic_hash(f"ref-{milestone}") if milestone in REFERENCE_REQUIRED else None,
        customs_status=customs_status,
    )
