#!/usr/bin/env bash
# Point git at the repo's hooks. Run once per clone. OWNER: P1.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath scripts/hooks
echo "hooks installed (core.hooksPath=scripts/hooks)."
[[ -n "$(git config --get s14.id || true)" ]] || echo "now run: git config s14.id p<N>"
