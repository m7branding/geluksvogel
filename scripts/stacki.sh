#!/usr/bin/env bash
# Opens Stacki on this project with the CMS sync watcher beside it, so text
# typed into a component's props lands in the corresponding src/data/*.json.
set -euo pipefail
cd "$(dirname "$0")/.."
STACKI_SRC="${STACKI_SRC:-$HOME/Downloads/stacki-main}"
if [[ ! -f "$STACKI_SRC/package.json" ]]; then
  echo "Stacki not found at $STACKI_SRC. Set STACKI_SRC to its folder." >&2
  exit 1
fi
git pull --rebase --autostash origin main
node scripts/cms-sync.mjs --watch &
watcher=$!
trap 'kill "$watcher" 2>/dev/null || true' EXIT
echo "Kies in Stacki Open Project… en selecteer: $PWD"
(cd "$STACKI_SRC" && npm start)
