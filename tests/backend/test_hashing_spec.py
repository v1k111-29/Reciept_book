"""Tests for backend/s14/domain/hashing.py. Owner: P4."""

from __future__ import annotations

import hashlib
from datetime import date

import pytest

from s14.domain import hashing


def test_canonical_string():
    assert hashing.canonical_sb_string(" 1234567 ", "inmaa1", date(2026, 11, 3)) == (
        "INMAA1|1234567|2026-11-03")


def test_sb_hash_is_salted_sha256_of_canonical():
    expected = hashlib.sha256(b"salt" + b"INMAA1|1234567|2026-11-03").hexdigest()
    assert hashing.shipping_bill_hash("1234567", "INMAA1", date(2026, 11, 3), "salt") == expected


def test_sb_hash_depends_on_salt():
    a = hashing.shipping_bill_hash("1", "P", date(2026, 1, 1), "s1")
    b = hashing.shipping_bill_hash("1", "P", date(2026, 1, 1), "s2")
    assert a != b and len(a) == 64


def test_empty_salt_rejected():
    with pytest.raises(ValueError):
        hashing.shipping_bill_hash("1", "P", date(2026, 1, 1), "")


def test_reference_hash_strips_whitespace():
    assert hashing.reference_hash(" IRM42 ", "s") == hashing.reference_hash("IRM42", "s")
