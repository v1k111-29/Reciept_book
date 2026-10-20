"""Tests for the HTTP gateway client with mocked HTTP responses."""

from __future__ import annotations

import httpx

from s14.contracts import ChaincodeFunction, ErrorBody, ErrorCode, GatewayRequest, GatewayResult, OrgRole
from s14.gateway_client import HttpGateway


def test_submit_and_evaluate_use_contract_paths_and_wire_shape(monkeypatch):
    calls: list[tuple[str, dict[str, object], float]] = []

    def post(url: str, *, json: dict[str, object], timeout: float) -> httpx.Response:
        calls.append((url, json, timeout))
        body = {"ok": True, "tx_id": "tx-1"} if url.endswith("/submit") else {"ok": True, "payload": []}
        return httpx.Response(200, json=body)

    monkeypatch.setattr(httpx, "post", post)
    gateway = HttpGateway("http://gateway/", timeout_s=2.5)
    request = GatewayRequest(
        function=ChaincodeFunction.CREATE_RECORD,
        args=("a" * 64,),
        identity=OrgRole.AD_BANK,
    )

    assert gateway.submit(request).tx_id == "tx-1"
    assert gateway.evaluate(request).payload == []
    assert calls == [
        (
            "http://gateway/submit",
            {"function": "CreateRecord", "args": ["a" * 64], "identity": "AD_BANK"},
            2.5,
        ),
        (
            "http://gateway/evaluate",
            {"function": "CreateRecord", "args": ["a" * 64], "identity": "AD_BANK"},
            2.5,
        ),
    ]


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
