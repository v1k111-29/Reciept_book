"""S14 Receipt Book: shared contracts (types every module agrees on).

OWNER: P1 (team lead). Nobody else edits this file.
To change it, add a request to docs/logs/<your-id>.md under "Contract change requests"
and tell the lead. After G1 the contracts are FROZEN: changes need a version bump
(CONTRACTS_VERSION) and a regenerated contracts/contracts.schema.json
(run: uv run python scripts/export_schema.py).

What lives here: enums, data shapes, ownership rules (who may write which milestone),
precondition rules (which milestone must exist first), error codes and route names.
What does NOT live here: logic. Hashing, classification and metrics are implemented
in backend/s14/domain/ (P4); the ledger rules are re-implemented in chaincode (P2) and
checked against this file by tests.

Sources behind the rules are cited inline as [P]/[S]/[I] (see docs/PROBLEM.md):
  [P] primary source, [S] secondary, [I] our inference (design choice, not a fact).
"""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

CONTRACTS_VERSION = "0.1.0"

# A SHA-256 hex digest: 64 lowercase hex characters.
HASH_PATTERN = r"^[0-9a-f]{64}$"


# --------------------------------------------------------------------------- enums


class OrgRole(StrEnum):
    """Role of a Drunix organisation (MSP) in the pilot."""

    AD_BANK = "AD_BANK"  # authorised dealer bank: receives export payments
    EXPORTERS_BODY = "EXPORTERS_BODY"  # signs on the exporter's side [I]
    CUSTOMS_VIEWER = "CUSTOMS_VIEWER"  # read-only, non-essential feature N3


class Milestone(StrEnum):
    """Milestones recorded per shipping bill (docs/PROBLEM.md, Part 6.3)."""

    DOCS_ACKNOWLEDGED = "DOCS_ACKNOWLEDGED"  # bank acknowledges the exporter's documents
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED"  # bank records the IRM (reference hashed)
    EBRC_SELF_CERTIFIED = "EBRC_SELF_CERTIFIED"  # exporter side records the eBRC number (hashed)
    EDPMS_MARKED_OFF = "EDPMS_MARKED_OFF"  # bank records that it marked off EDPMS
    CUSTOMS_STATUS_OBSERVED = "CUSTOMS_STATUS_OBSERVED"  # what Customs (ICES/ICEGATE) shows


class CustomsStatus(StrEnum):
    REALISED = "REALISED"
    PENDING = "PENDING"


class CauseBucket(StrEnum):
    """Where a Customs 'pending' most likely comes from (docs/PROBLEM.md, 4.3). Heuristic [I]."""

    CONSISTENT = "CONSISTENT"  # latest Customs observation is not PENDING (or none yet)
    NO_PAYMENT_RECORDED = "NO_PAYMENT_RECORDED"  # (d) no payment on the book
    EXPORTER_LINKAGE_MISSING = "EXPORTER_LINKAGE_MISSING"  # (c) documents never acknowledged
    BANK_NOT_MARKED_OFF = "BANK_NOT_MARKED_OFF"  # (a) payment + docs, but no mark-off
    DOWNSTREAM_SYNC = "DOWNSTREAM_SYNC"  # (b) mark-off signed, Customs still pending


class ChaincodeFunction(StrEnum):
    """Transaction names exposed by the chaincode (P2) and called by the gateway (P3)."""

    CREATE_RECORD = "CreateRecord"
    RECORD_MILESTONE = "RecordMilestone"
    GET_RECORD = "GetRecord"
    LIST_RECORDS = "ListRecords"


class ErrorCode(StrEnum):
    VALIDATION = "VALIDATION"  # malformed input
    NOT_FOUND = "NOT_FOUND"  # no record for this sb_hash
    ALREADY_EXISTS = "ALREADY_EXISTS"  # CreateRecord on an existing sb_hash
    WRONG_ROLE = "WRONG_ROLE"  # submitter's role may not write this milestone
    WRONG_BANK = "WRONG_BANK"  # a bank other than the record's bank tried to write
    PRECONDITION_FAILED = "PRECONDITION_FAILED"  # a required earlier milestone is missing
    DUPLICATE_MILESTONE = "DUPLICATE_MILESTONE"  # a non-repeatable milestone already exists
    ENDORSEMENT_FAILED = "ENDORSEMENT_FAILED"  # endorsement policy not satisfied
    LEDGER_UNAVAILABLE = "LEDGER_UNAVAILABLE"  # gateway cannot reach Drunix


# ------------------------------------------------------------------ ownership rules

# Who may submit each milestone. Every write is ALSO subject to the network-level
# endorsement policy set at deploy time (both orgs must endorse) [I].
WRITER_ROLE: dict[Milestone, OrgRole] = {
    Milestone.DOCS_ACKNOWLEDGED: OrgRole.AD_BANK,
    Milestone.PAYMENT_RECEIVED: OrgRole.AD_BANK,
    Milestone.EBRC_SELF_CERTIFIED: OrgRole.EXPORTERS_BODY,
    Milestone.EDPMS_MARKED_OFF: OrgRole.AD_BANK,  # only the record's own bank [I]
    Milestone.CUSTOMS_STATUS_OBSERVED: OrgRole.EXPORTERS_BODY,  # until Customs joins (N3)
}

# Milestones that must already be on the record before this one is accepted.
#  - eBRC needs an IRM first: DGFT FAQ Q30 "Exporter cannot generate the eBRC without IRM" [P]
#  - mark-off is "after ensuring that the export value has been realised" (Reg 18(1)(g)) [P]
#    and after the bank checks documents against payment [S]
PRECONDITIONS: dict[Milestone, tuple[Milestone, ...]] = {
    Milestone.DOCS_ACKNOWLEDGED: (),
    Milestone.PAYMENT_RECEIVED: (),
    Milestone.EBRC_SELF_CERTIFIED: (Milestone.PAYMENT_RECEIVED,),
    Milestone.EDPMS_MARKED_OFF: (Milestone.DOCS_ACKNOWLEDGED, Milestone.PAYMENT_RECEIVED),
    Milestone.CUSTOMS_STATUS_OBSERVED: (),
}

# Only Customs observations may be recorded more than once (status can change) [I].
REPEATABLE: frozenset[Milestone] = frozenset({Milestone.CUSTOMS_STATUS_OBSERVED})

# Milestones that must carry a reference_hash (hash of the IRM / eBRC number / document set).
REFERENCE_REQUIRED: frozenset[Milestone] = frozenset(
    {Milestone.DOCS_ACKNOWLEDGED, Milestone.PAYMENT_RECEIVED, Milestone.EBRC_SELF_CERTIFIED}
)

# Default MSP-to-role mapping for the 2-org Drunix test network (G1). Org3 is N2.
DEFAULT_MSP_ROLES: dict[str, OrgRole] = {
    "Org1MSP": OrgRole.AD_BANK,
    "Org2MSP": OrgRole.EXPORTERS_BODY,
}


# ----------------------------------------------------------------------- models


class _Model(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class MilestoneSubmission(_Model):
    """What a client asks to record. Sent backend -> gateway -> chaincode."""

    sb_hash: str = Field(pattern=HASH_PATTERN)
    milestone: Milestone
    occurred_on: date  # the date the submitter attests the real-world step happened
    reference_hash: str | None = Field(default=None, pattern=HASH_PATTERN)
    customs_status: CustomsStatus | None = None
    note: str | None = Field(default=None, max_length=280)

    @model_validator(mode="after")
    def _check_fields(self) -> MilestoneSubmission:
        is_customs = self.milestone == Milestone.CUSTOMS_STATUS_OBSERVED
        if is_customs and self.customs_status is None:
            raise ValueError("customs_status is required for CUSTOMS_STATUS_OBSERVED")
        if not is_customs and self.customs_status is not None:
            raise ValueError("customs_status is only allowed for CUSTOMS_STATUS_OBSERVED")
        if self.milestone in REFERENCE_REQUIRED and self.reference_hash is None:
            raise ValueError(f"reference_hash is required for {self.milestone}")
        return self


class MilestoneEvent(_Model):
    """A milestone as stored on the ledger (chaincode adds tx_id, time and submitter)."""

    sb_hash: str = Field(pattern=HASH_PATTERN)
    milestone: Milestone
    occurred_on: date
    reference_hash: str | None = Field(default=None, pattern=HASH_PATTERN)
    customs_status: CustomsStatus | None = None
    note: str | None = Field(default=None, max_length=280)
    tx_id: str
    ledger_time: datetime  # transaction timestamp from the ledger
    submitter_msp: str
    submitter_role: OrgRole


class ShippingBillRecord(_Model):
    """One record per shipping bill. Raw shipping-bill numbers never go on the ledger."""

    sb_hash: str = Field(pattern=HASH_PATTERN)
    bank_msp: str  # the AD bank that created the record; only it may write bank milestones
    created_ledger_time: datetime
    events: tuple[MilestoneEvent, ...] = ()


class CreateRecordRequest(_Model):
    """Frontend -> backend. The backend hashes these fields (P4, domain/hashing.py)."""

    sb_number: str = Field(min_length=1, max_length=20)
    port_code: str = Field(min_length=1, max_length=10)
    sb_date: date


class MilestoneRequest(_Model):
    """Frontend -> backend. Carries the RAW reference (IRM / eBRC number / document id);
    the backend hashes it with the server-side salt and sends a MilestoneSubmission on.
    The raw value is never stored or logged (FEATURES.md E9)."""

    milestone: Milestone
    occurred_on: date
    acting_as: OrgRole  # which desk is acting; the backend picks that org's gateway identity
    reference: str | None = Field(default=None, min_length=1, max_length=64)
    customs_status: CustomsStatus | None = None
    note: str | None = Field(default=None, max_length=280)

    @model_validator(mode="after")
    def _check_fields(self) -> MilestoneRequest:
        is_customs = self.milestone == Milestone.CUSTOMS_STATUS_OBSERVED
        if is_customs != (self.customs_status is not None):
            raise ValueError("customs_status is required for, and only for, CUSTOMS_STATUS_OBSERVED")
        if self.milestone in REFERENCE_REQUIRED and self.reference is None:
            raise ValueError(f"reference is required for {self.milestone}")
        return self


class TxReceipt(_Model):
    """Backend -> frontend after a successful write."""

    sb_hash: str = Field(pattern=HASH_PATTERN)
    tx_id: str


class CauseAssessment(_Model):
    bucket: CauseBucket
    missing: tuple[Milestone, ...] = ()
    explanation: str


class TimelineView(_Model):
    """Backend -> frontend: one shipping bill's history plus the cause assessment."""

    record: ShippingBillRecord
    assessment: CauseAssessment


class MetricsSummary(_Model):
    """The three pilot measures (docs/PROBLEM.md, 6.6). None = not enough data."""

    n_records: int = Field(ge=0)
    median_docs_handover_to_ack_days: float | None = None
    median_payment_to_markoff_days: float | None = None
    pending_total: int = Field(default=0, ge=0)
    pending_with_markoff: int = Field(default=0, ge=0)
    pending_with_markoff_share: float | None = Field(default=None, ge=0, le=1)


class ErrorBody(_Model):
    code: ErrorCode
    message: str


class GatewayRequest(_Model):
    """Backend (P4) -> gateway (P3). `identity` picks which org's credentials sign."""

    function: ChaincodeFunction
    args: tuple[str, ...] = ()
    identity: OrgRole


class GatewayResult(_Model):
    """Gateway (P3) -> backend (P4)."""

    ok: bool
    tx_id: str | None = None
    payload: Any = None
    error: ErrorBody | None = None

    @model_validator(mode="after")
    def _check(self) -> GatewayResult:
        if self.ok and self.error is not None:
            raise ValueError("ok results carry no error")
        if not self.ok and self.error is None:
            raise ValueError("failed results must carry an error")
        return self


# ------------------------------------------------------------------- HTTP routes

# Backend routes (P4 implements, P5 calls). Path params in braces.
BACKEND_ROUTES: dict[str, str] = {
    "health": "GET /health",
    "create_record": "POST /records",  # CreateRecordRequest -> TxReceipt
    "record_milestone": "POST /records/{sb_hash}/milestones",  # MilestoneRequest -> TxReceipt
    "get_timeline": "GET /records/{sb_hash}",  # -> TimelineView
    "list_records": "GET /records",  # -> list[TimelineView]
    "metrics": "GET /metrics",  # -> MetricsSummary
}

# Gateway routes (P3 implements, P4 calls).
GATEWAY_ROUTES: dict[str, str] = {
    "health": "GET /health",
    "submit": "POST /submit",  # write transactions (endorse + order + commit)
    "evaluate": "POST /evaluate",  # read-only queries
}

# Every model exported to contracts/contracts.schema.json for the TypeScript side.
SCHEMA_MODELS: tuple[type[BaseModel], ...] = (
    MilestoneSubmission,
    MilestoneEvent,
    ShippingBillRecord,
    CreateRecordRequest,
    MilestoneRequest,
    TxReceipt,
    CauseAssessment,
    TimelineView,
    MetricsSummary,
    ErrorBody,
    GatewayRequest,
    GatewayResult,
)
SCHEMA_ENUMS: tuple[type[StrEnum], ...] = (
    OrgRole,
    Milestone,
    CustomsStatus,
    CauseBucket,
    ChaincodeFunction,
    ErrorCode,
)
