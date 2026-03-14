#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/portfolio}"
SERVER_DIR="${SERVER_DIR:-${APP_DIR}/server}"
BRANCH="${BRANCH:-main}"
SERVER_RESTART_CMD="${SERVER_RESTART_CMD:-}"

echo "Starting deploy in ${APP_DIR} on branch ${BRANCH}"

cd "${APP_DIR}"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

if [[ ! -d "${SERVER_DIR}" ]]; then
  echo "Server directory not found: ${SERVER_DIR}" >&2
  exit 1
fi

echo "Installing server dependencies in ${SERVER_DIR}"
cd "${SERVER_DIR}"
if [[ -f package-lock.json ]]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi

echo "Running database migrations"
npm run db:create-users
npm run db:create-sessions
npm run db:migrate-positions-user-id
npm run db:create-portfolio-value-snapshots
npm run db:create-transactions

restart_with_pm2() {
  if ! command -v pm2 >/dev/null 2>&1; then
    return 1
  fi

  local target
  target="$(pm2 jlist 2>/dev/null | node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const raw = fs.readFileSync(0, "utf8").trim();
    const list = raw ? JSON.parse(raw) : [];
    const match = list.find((entry) => {
      const env = entry && entry.pm2_env ? entry.pm2_env : {};
      return env.pm_cwd === path || env.pm_exec_path === path + "/server.js";
    });
    if (match && (match.name || match.pm_id !== undefined)) {
      process.stdout.write(String(match.name || match.pm_id));
    }
  ' "${SERVER_DIR}")"

  if [[ -n "${target}" ]]; then
    echo "Restarting server with pm2 target: ${target}"
    pm2 restart "${target}"
    return 0
  fi

  return 1
}

restart_with_systemd() {
  if ! command -v systemctl >/dev/null 2>&1; then
    return 1
  fi

  local unit
  unit="$(
    systemctl list-units --type=service --all --no-legend 2>/dev/null \
      | awk '{print $1}' \
      | grep -Ei 'portfolio|tracker' \
      | head -n 1 || true
  )"

  if [[ -n "${unit}" ]]; then
    echo "Restarting server with systemd unit: ${unit}"
    systemctl restart "${unit}"
    return 0
  fi

  return 1
}

echo "Restarting backend service"
if [[ -n "${SERVER_RESTART_CMD}" ]]; then
  echo "Using explicit restart command"
  eval "${SERVER_RESTART_CMD}"
elif restart_with_pm2; then
  :
elif restart_with_systemd; then
  :
else
  echo "Unable to determine how to restart the backend. Set SERVER_RESTART_CMD in deploy." >&2
  exit 1
fi

echo "Deploy finished"
