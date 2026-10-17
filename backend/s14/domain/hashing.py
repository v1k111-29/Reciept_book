"""Hashing of off-chain identifiers before they reach the ledger. Owner: P4.

Rule: raw shipping-bill numbers, IRM numbers and eBRC numbers never go on the ledger;
only salted SHA-256 hashes do (docs/PROBLEM.md, 6.3). The salt is per-deployment and
lives in an environment variable (S14_HASH_SALT), never in the repo.
"""

from __future__ import annotations

from datetime import date


def canonical_sb_string(sb_number: str, port_code: str, sb_date: date) -> str:
    """Return 'PORTCODE|SBNUMBER|YYYY-MM-DD': upper-cased, whitespace stripped.

    Spec: tests/backend/test_hashing_spec.py
    """
    raise NotImplementedError("P4: implement in G2")


def shipping_bill_hash(sb_number: str, port_code: str, sb_date: date, salt: str) -> str:
    """SHA-256 hex of salt + canonical_sb_string(...). Empty salt is an error (ValueError)."""
    raise NotImplementedError("P4: implement in G2")


def reference_hash(reference: str, salt: str) -> str:
    """SHA-256 hex of salt + reference.strip() for IRM numbers, eBRC numbers, document sets."""
    raise NotImplementedError("P4: implement in G2")
