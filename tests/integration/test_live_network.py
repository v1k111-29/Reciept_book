"""End-to-end tests against a REAL Drunix test network. Owner: P1.

Skipped unless S14_LIVE=1 and the gateway is up (see network/README.md). Run on the
machine that hosts the network, at G2 and every gate after.
"""

from __future__ import annotations

import os

import pytest

live = pytest.mark.skipif(os.environ.get("S14_LIVE") != "1", reason="needs Drunix network (S14_LIVE=1)")


@live
def test_gateway_health():
    import httpx

    url = os.environ.get("S14_GATEWAY_URL", "http://localhost:8800")
    assert httpx.get(f"{url}/health", timeout=5).status_code == 200


@live
@pytest.mark.xfail(strict=True, reason="P1: write at G2 once the vertical slice exists")
def test_create_record_and_payment_milestone_roundtrip():
    raise AssertionError("G2: create record as AD_BANK, record PAYMENT_RECEIVED, read it back")
