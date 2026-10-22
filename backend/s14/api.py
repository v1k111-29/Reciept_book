"""FastAPI app. Owner: P4. Routes must match contracts.BACKEND_ROUTES.

Run locally: uv run uvicorn s14.api:app --app-dir backend --port 8000
Routes are implemented by gate; /health is available from G0.
"""

from __future__ import annotations

import json
import os

from fastapi import Depends, FastAPI, Path, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import TypeAdapter, ValidationError

from s14.contracts import (
    CREATE_RECORD_ROLE,
    CONTRACTS_VERSION,
    ERROR_HTTP_STATUS,
    HASH_PATTERN,
    ChaincodeFunction,
    CreateRecordRequest,
    ErrorBody,
    ErrorCode,
    GatewayRequest,
    GatewayResult,
    MetricsSummary,
    Milestone,
    OrgRole,
    MilestoneRequest,
    MilestoneSubmission,
    ShippingBillRecord,
    TimelineView,
    TxReceipt,
)
from s14.domain.assessment import assess
from s14.domain.hashing import reference_hash, shipping_bill_hash
from s14.domain.metrics import summarise
from s14.gateway_client import Gateway, HttpGateway

app = FastAPI(title="S14 Receipt Book API", version="0.1.0")
_RECORDS_ADAPTER = TypeAdapter(list[ShippingBillRecord])


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(
    _request: Request,
    _exc: RequestValidationError,
) -> JSONResponse:
    return _error_response(ErrorBody(code=ErrorCode.VALIDATION, message="Request validation failed."))


def get_gateway() -> Gateway:
    return HttpGateway()


def _error_response(error: ErrorBody) -> JSONResponse:
    return JSONResponse(
        status_code=ERROR_HTTP_STATUS[error.code],
        content=error.model_dump(mode="json"),
    )


def _gateway_error(result: GatewayResult) -> JSONResponse:
    if result.error is None:
        return _error_response(
            ErrorBody(code=ErrorCode.INTERNAL, message="Gateway returned an unsuccessful result without an error.")
        )
    return _error_response(result.error)


def _list_records(gateway: Gateway) -> list[ShippingBillRecord] | JSONResponse:
    result = gateway.evaluate(
        GatewayRequest(
            function=ChaincodeFunction.LIST_RECORDS,
            args=(),
            identity=OrgRole.AD_BANK,
        )
    )
    if not result.ok:
        return _gateway_error(result)
    try:
        return _RECORDS_ADAPTER.validate_python(result.payload)
    except ValidationError:
        return _error_response(
            ErrorBody(code=ErrorCode.INTERNAL, message="Gateway returned an invalid shipping-bill record list.")
        )


def _unknown_write_committed(
    gateway: Gateway,
    sb_hash: str,
    result: GatewayResult,
    milestone: Milestone | None = None,
) -> bool:
    check = gateway.evaluate(
        GatewayRequest(
            function=ChaincodeFunction.GET_RECORD,
            args=(sb_hash,),
            identity=OrgRole.AD_BANK,
        )
    )
    if not check.ok:
        return False
    try:
        record = ShippingBillRecord.model_validate(check.payload)
    except ValidationError:
        return False
    if record.sb_hash != sb_hash:
        return False
    if milestone is None:
        return True
    return any(event.tx_id == result.tx_id and event.milestone is milestone for event in record.events)


def _hash_salt() -> str | JSONResponse:
    salt = os.environ.get("S14_HASH_SALT")
    if not salt:
        return _error_response(
            ErrorBody(code=ErrorCode.INTERNAL, message="S14_HASH_SALT is not configured.")
        )
    return salt


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "contracts_version": CONTRACTS_VERSION}


@app.post("/records", response_model=TxReceipt)
def create_record(
    request: CreateRecordRequest,
    gateway: Gateway = Depends(get_gateway),
) -> TxReceipt | JSONResponse:
    salt = _hash_salt()
    if isinstance(salt, JSONResponse):
        return salt

    sb_hash = shipping_bill_hash(request.sb_number, request.port_code, request.sb_date, salt)
    result = gateway.submit(
        GatewayRequest(
            function=ChaincodeFunction.CREATE_RECORD,
            args=(sb_hash,),
            identity=CREATE_RECORD_ROLE,
        )
    )
    if not result.ok:
        if (
            result.error is not None
            and result.error.code is ErrorCode.OUTCOME_UNKNOWN
            and result.tx_id is not None
            and _unknown_write_committed(gateway, sb_hash, result)
        ):
            return TxReceipt(sb_hash=sb_hash, tx_id=result.tx_id)
        return _gateway_error(result)
    if result.tx_id is None:
        return _error_response(
            ErrorBody(code=ErrorCode.INTERNAL, message="Gateway returned a successful write without a transaction ID.")
        )
    return TxReceipt(sb_hash=sb_hash, tx_id=result.tx_id)


@app.post("/records/{sb_hash}/milestones", response_model=TxReceipt)
def record_milestone(
    request: MilestoneRequest,
    sb_hash: str = Path(pattern=HASH_PATTERN),
    gateway: Gateway = Depends(get_gateway),
) -> TxReceipt | JSONResponse:
    salt = _hash_salt()
    if isinstance(salt, JSONResponse):
        return salt

    reference = reference_hash(request.reference, salt) if request.reference is not None else None
    submission = MilestoneSubmission(
        sb_hash=sb_hash,
        milestone=request.milestone,
        occurred_on=request.occurred_on,
        reference_hash=reference,
        customs_status=request.customs_status,
    )

    result = gateway.submit(
        GatewayRequest(
            function=ChaincodeFunction.RECORD_MILESTONE,
            args=(json.dumps(submission.model_dump(mode="json", exclude_none=True), separators=(",", ":")),),
            identity=request.acting_as,
        )
    )
    if not result.ok:
        if (
            result.error is not None
            and result.error.code is ErrorCode.OUTCOME_UNKNOWN
            and result.tx_id is not None
            and _unknown_write_committed(gateway, sb_hash, result, request.milestone)
        ):
            return TxReceipt(sb_hash=sb_hash, tx_id=result.tx_id)
        return _gateway_error(result)
    if result.tx_id is None:
        return _error_response(
            ErrorBody(code=ErrorCode.INTERNAL, message="Gateway returned a successful write without a transaction ID.")
        )
    return TxReceipt(sb_hash=sb_hash, tx_id=result.tx_id)


@app.get("/records/{sb_hash}", response_model=TimelineView)
def get_timeline(
    sb_hash: str = Path(pattern=HASH_PATTERN),
    gateway: Gateway = Depends(get_gateway),
) -> TimelineView | JSONResponse:
    result = gateway.evaluate(
        GatewayRequest(
            function=ChaincodeFunction.GET_RECORD,
            args=(sb_hash,),
            identity=OrgRole.AD_BANK,
        )
    )
    if not result.ok:
        return _gateway_error(result)
    try:
        record = ShippingBillRecord.model_validate(result.payload)
    except ValidationError:
        return _error_response(
            ErrorBody(code=ErrorCode.INTERNAL, message="Gateway returned an invalid shipping-bill record.")
        )
    return TimelineView(record=record, assessment=assess(record))


@app.get("/records", response_model=list[TimelineView])
def list_records(gateway: Gateway = Depends(get_gateway)) -> list[TimelineView] | JSONResponse:
    records = _list_records(gateway)
    if isinstance(records, JSONResponse):
        return records
    return [TimelineView(record=record, assessment=assess(record)) for record in records]


@app.get("/metrics", response_model=MetricsSummary)
def get_metrics(gateway: Gateway = Depends(get_gateway)) -> MetricsSummary | JSONResponse:
    records = _list_records(gateway)
    if isinstance(records, JSONResponse):
        return records
    return summarise(records)
