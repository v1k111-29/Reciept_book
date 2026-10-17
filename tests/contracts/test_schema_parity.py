"""The committed JSON schema must match contracts.py. Owner: P1.

If this fails: run `uv run python scripts/export_schema.py`, commit the JSON, and tell
every owner (contract change protocol, IMPLEMENTATION_PLAN.md Part 4).
"""

from __future__ import annotations

from pathlib import Path

from scripts.export_schema import OUT, render


def test_committed_schema_is_current():
    assert Path(OUT).exists(), "contracts/contracts.schema.json missing: run scripts/export_schema.py"
    assert Path(OUT).read_text(encoding="utf-8") == render(), (
        "contracts.schema.json is stale: run `uv run python scripts/export_schema.py`"
    )
