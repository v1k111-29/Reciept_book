"""Tests for the HTTP gateway client with mocked HTTP responses."""

from __future__ import annotations

import httpx
import pytest

from s14.contracts import (
    ChaincodeFunction,
    ErrorBody,
    ErrorCode,
    GatewayRequest,
    GatewayResult,
    OrgRole,
)
from s14.gateway_client import HttpGateway

_RECORD_PAYLOAD = {
    "sb_hash": "a" * 64,
    "bank_msp": "Org1MSP",
    "created_ledger_time": "2026-10-20T00:00:00Z",
    "events": [],
}
_EVENT_PAYLOAD = {
    "sb_hash": "a" * 64,
    "milestone": "DOCS_ACKNOWLEDGED",
    "occurred_on": "2026-10-20",
    "reference_hash": "b" * 64,
    "tx_id": "tx-1",
    "ledger_time": "2026-10-20T00:00:00Z",
    "submitter_msp": "Org1MSP",
    "submitter_role": "AD_BANK",
}


def test_submit_and_evaluate_use_contract_paths_and_wire_shape(monkeypatch):
    calls: list[tuple[str, dict[str, object], float]] = []

    def post(url: str, *, json: dict[str, object], timeout: float) -> httpx.Response:
        calls.append((url, json, timeout))
        body = (
            {"ok": True, "tx_id": "tx-1", "payload": _RECORD_PAYLOAD}
            if url.endswith("/submit")
            else {"ok": True, "payload": []}
        )
        return httpx.Response(200, json=body)

    monkeypatch.setattr(httpx, "post", post)
    gateway = HttpGateway("http://gateway/", timeout_s=2.5)
    request = GatewayRequest(
        function=ChaincodeFunction.CREATE_RECORD,
        args=("a" * 64,),
        identity=OrgRole.AD_BANK,
    )

    assert gateway.submit(request).tx_id == "tx-1"
    list_request = GatewayRequest(
        function=ChaincodeFunction.LIST_RECORDS,
        args=(),
        identity=OrgRole.AD_BANK,
    )
    assert gateway.evaluate(list_request).payload == []
    assert calls == [
        (
            "http://gateway/submit",
            {"function": "CreateRecord", "args": ["a" * 64], "identity": "AD_BANK"},
            2.5,
        ),
        (
            "http://gateway/evaluate",
            {"function": "ListRecords", "args": [], "identity": "AD_BANK"},
            2.5,
        ),
    ]


@pytest.mark.parametrize(
    ("function", "payload"),
    [
        (ChaincodeFunction.CREATE_RECORD, _RECORD_PAYLOAD),
        (ChaincodeFunction.RECORD_MILESTONE, _EVENT_PAYLOAD),
        (ChaincodeFunction.GET_RECORD, _RECORD_PAYLOAD),
        (ChaincodeFunction.LIST_RECORDS, [_RECORD_PAYLOAD]),
    ],
)
def test_successful_gateway_payload_matches_function_result_shape(monkeypatch, function, payload):
    tx_id = (
        "tx-1"
        if function
        in {ChaincodeFunction.CREATE_RECORD, ChaincodeFunction.RECORD_MILESTONE}
        else None
    )
    monkeypatch.setattr(
        httpx,
        "post",
        lambda *args, **kwargs: httpx.Response(
            200,
            json={"ok": True, "tx_id": tx_id, "payload": payload},
        ),
    )
    gateway = HttpGateway("http://gateway")
    request = GatewayRequest(function=function, args=(), identity=OrgRole.AD_BANK)

    result = gateway.submit(request) if function in {
        ChaincodeFunction.CREATE_RECORD,
        ChaincodeFunction.RECORD_MILESTONE,
    } else gateway.evaluate(request)

    assert result.ok
    assert result.payload == payload


@pytest.mark.parametrize(
    "function",
    [
        ChaincodeFunction.CREATE_RECORD,
        ChaincodeFunction.RECORD_MILESTONE,
        ChaincodeFunction.GET_RECORD,
        ChaincodeFunction.LIST_RECORDS,
    ],
)
def test_invalid_successful_gateway_payload_maps_to_internal(monkeypatch, function):
    tx_id = (
        "tx-1"
        if function
        in {ChaincodeFunction.CREATE_RECORD, ChaincodeFunction.RECORD_MILESTONE}
        else None
    )
    monkeypatch.setattr(
        httpx,
        "post",
        lambda *args, **kwargs: httpx.Response(
            200,
            json={"ok": True, "tx_id": tx_id, "payload": {}},
        ),
    )
    gateway = HttpGateway("http://gateway")
    request = GatewayRequest(function=function, args=(), identity=OrgRole.AD_BANK)

    result = gateway.submit(request) if function in {
        ChaincodeFunction.CREATE_RECORD,
        ChaincodeFunction.RECORD_MILESTONE,
    } else gateway.evaluate(request)

    assert not result.ok
    assert result.error is not None
    assert result.error.code is ErrorCode.INTERNAL


def test_transport_failure_maps_to_ledger_unavailable(monkeypatch):
    def post(url: str, **kwargs: object) -> httpx.Response:
        request = httpx.Request("POST", url)
        raise httpx.ConnectError("gateway offline", request=request)

    monkeypatch.setattr(httpx, "post", post)
    result = HttpGateway("http://gateway").submit(
        GatewayRequest(function=ChaincodeFunction.CREATE_RECORD, args=("a" * 64,), identity=OrgRole.AD_BANK)
    )

    assert not result.ok
    assert result.error is not None
    assert result.error.code is ErrorCode.LEDGER_UNAVAILABLE


def test_invalid_gateway_response_maps_to_internal(monkeypatch):
    monkeypatch.setattr(
        httpx,
        "post",
        lambda *args, **kwargs: httpx.Response(200, json={"unexpected": True}),
    )
    result = HttpGateway("http://gateway").submit(
        GatewayRequest(function=ChaincodeFunction.CREATE_RECORD, args=("a" * 64,), identity=OrgRole.AD_BANK)
    )

    assert result == GatewayResult(
        ok=False,
        error=ErrorBody(
            code=ErrorCode.INTERNAL,
            message="Gateway returned an invalid response (HTTP 200).",
        ),
    )
