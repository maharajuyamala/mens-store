#!/usr/bin/env bash
# Free Next.js default port and start the dev server.
set -euo pipefail

cd "$(dirname "$0")"

echo "Checking port 3000…"
PIDS=$(lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null || true)
if [[ -n "${PIDS}" ]]; then
  echo "Killing process(es) on port 3000: ${PIDS}"
  kill -9 ${PIDS} 2>/dev/null || true
  sleep 0.5
else
  echo "Nothing listening on port 3000."
fi

exec npm run dev
