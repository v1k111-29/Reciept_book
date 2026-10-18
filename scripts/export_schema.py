"""Export contracts.py to contracts/contracts.schema.json. Owner: P1.

The TypeScript packages (chaincode, gateway, frontend) read this JSON in their tests to
check they agree with contracts.py. Run after ANY contracts.py change:
    uv run python scripts/export_schema.py
tests/contracts/test_schema_parity.py fails if the committed JSON is stale.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from s14 import contracts as c  # noqa: E402

OUT = ROOT / "contracts" / "contracts.schema.json"


def build() -> dict:
    return {
        "contracts_version": c.CONTRACTS_VERSION,
        "hash_pattern": c.HASH_PATTERN,
        "enums": {e.__name__: [m.value for m in e] for e in c.SCHEMA_ENUMS},
        "writer_role": {k.value: v.value for k, v in c.WRITER_ROLE.items()},
        "preconditions": {k.value: [p.value for p in v] for k, v in c.PRECONDITIONS.items()},
        "repeatable": sorted(m.value for m in c.REPEATABLE),
        "reference_required": sorted(m.value for m in c.REFERENCE_REQUIRED),
        "default_msp_roles": {k: v.value for k, v in c.DEFAULT_MSP_ROLES.items()},
        "create_record_role": c.CREATE_RECORD_ROLE.value,
        "chaincode_args": {k.value: list(v) for k, v in c.CHAINCODE_ARGS.items()},
        "chaincode_result": {k.value: v for k, v in c.CHAINCODE_RESULT.items()},
        "chaincode_writes": sorted(f.value for f in c.CHAINCODE_WRITES),
        "retryable_errors": sorted(e.value for e in c.RETRYABLE_ERRORS),
        "error_http_status": {k.value: v for k, v in c.ERROR_HTTP_STATUS.items()},
        "backend_routes": c.BACKEND_ROUTES,
        "gateway_routes": c.GATEWAY_ROUTES,
        "models": {m.__name__: m.model_json_schema() for m in c.SCHEMA_MODELS},
    }


def render() -> str:
    return json.dumps(build(), indent=2, sort_keys=True) + "\n"


if __name__ == "__main__":
    OUT.write_text(render(), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")
