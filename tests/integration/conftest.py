"""Fixtures for the live Drunix tests. Owner: P1. The client is in live_client.py."""

from __future__ import annotations

import os

import pytest

from tests.integration.live_client import LiveGateway, synthetic_hash


@pytest.fixture(scope="session")
def gw() -> LiveGateway:
    return LiveGateway(os.environ.get("S14_GATEWAY_URL", "http://localhost:8800"))


@pytest.fixture
def sb_hash() -> str:
    return synthetic_hash("sb")
