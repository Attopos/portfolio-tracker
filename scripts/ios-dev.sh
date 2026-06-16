#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/pf-web/server"
PORT="${PORT:-3000}"
BACKEND_URL="${BACKEND_URL:-http://localhost:$PORT}"
HEALTH_URL="$BACKEND_URL/api/health"
PID_FILE="${TMPDIR:-/tmp}/portfolio-tracker-ios-dev.pid"
LOG_FILE="${TMPDIR:-/tmp}/portfolio-tracker-ios-dev.log"

is_server_reachable() {
  curl -sS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1
}

print_status() {
  local response
  response="$(curl -sS --max-time 3 "$HEALTH_URL" 2>/dev/null || true)"

  if [[ -z "$response" ]]; then
    echo "Backend did not return a health response."
    return
  fi

  echo "Backend health: $response"
}

if is_server_reachable; then
  echo "Backend is already running at $BACKEND_URL"
  print_status
  exit 0
fi

echo "Starting Portfolio Tracker backend at $BACKEND_URL"
echo "Logs: $LOG_FILE"

(
  cd "$SERVER_DIR"
  PORT="$PORT" BACKEND_URL="$BACKEND_URL" nohup npm run dev >"$LOG_FILE" 2>&1 &
  echo "$!" >"$PID_FILE"
)

for _ in {1..30}; do
  if is_server_reachable; then
    echo "Backend is ready at $BACKEND_URL"
    print_status
    exit 0
  fi

  sleep 1
done

echo "Backend did not become reachable after 30 seconds."
echo "Last log lines:"
tail -40 "$LOG_FILE" || true
exit 1
