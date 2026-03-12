#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/portfolio}"
BRANCH="${BRANCH:-main}"

echo "Starting deploy in ${APP_DIR} on branch ${BRANCH}"

cd "${APP_DIR}"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "Deploy finished"
