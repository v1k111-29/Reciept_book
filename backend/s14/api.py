"""FastAPI app. Owner: P4. Routes must match contracts.BACKEND_ROUTES.

Run locally: uv run uvicorn s14.api:app --app-dir backend --port 8000
Only /health exists at G0; every other route is added from G2 on.
"""

from __future__ import annotations

from fastapi import FastAPI

from s14.contracts import CONTRACTS_VERSION

app = FastAPI(title="S14 Receipt Book API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "contracts_version": CONTRACTS_VERSION}
