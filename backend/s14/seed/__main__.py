"""Seed command: uv run python -m s14.seed [--count 30] [--backend http://localhost:8000]

Loads synthetic demo shipping bills through the running backend (which needs the gateway and
Drunix network up). Prints counts per cause bucket afterwards, from GET /records.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter

import httpx

from s14.seed.demo import DEFAULT_COUNT, expected_buckets, load_records


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Load synthetic demo records via the backend.")
    parser.add_argument("--count", type=int, default=DEFAULT_COUNT)
    parser.add_argument("--backend", default=os.environ.get("S14_BACKEND_URL", "http://localhost:8000"))
    args = parser.parse_args(argv)

    with httpx.Client(base_url=args.backend, timeout=60.0) as client:

        def post(path: str, body: dict[str, object]) -> tuple[int, dict[str, object]]:
            response = client.post(path, json=body)
            return response.status_code, response.json()

        loaded, errors = load_records(post, args.count)
        print(f"loaded {loaded}/{args.count} synthetic records (synthetic demo data)")
        for line in errors:
            print(f"ERROR {line}", file=sys.stderr)
        listing = client.get("/records")
        if listing.status_code == 200:
            counts = Counter(item["assessment"]["bucket"] for item in listing.json())
            print("on ledger by cause bucket:", dict(counts))
        print("seeded by bucket:", {b.value: n for b, n in expected_buckets(args.count).items()})
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
