#!/usr/bin/env bash

set -euo pipefail

VPS_ALIAS="${VPS_ALIAS:-portfolio-vps}"
APP_DIR="${APP_DIR:-/var/www/portfolio}"
SERVER_DIR="${SERVER_DIR:-${APP_DIR}/server}"
CLIENT_DIR="${CLIENT_DIR:-${APP_DIR}/client}"
FRONTEND_PUBLISH_DIR="${FRONTEND_PUBLISH_DIR:-}"
BRANCH="${BRANCH:-main}"

ssh "${VPS_ALIAS}" \
  "APP_DIR='${APP_DIR}' SERVER_DIR='${SERVER_DIR}' CLIENT_DIR='${CLIENT_DIR}' FRONTEND_PUBLISH_DIR='${FRONTEND_PUBLISH_DIR}' BRANCH='${BRANCH}' bash -s" \
  < scripts/deploy.sh
