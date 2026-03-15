#!/usr/bin/env bash

set -euo pipefail

VPS_ALIAS="${VPS_ALIAS:-portfolio-vps}"
APP_DIR="${APP_DIR:-/var/www/portfolio}"

ssh "${VPS_ALIAS}" "
  set -e
  printf '%s\n' '--- app dir ---'
  ls -la '${APP_DIR}'
  printf '%s\n' '--- client dist ---'
  ls -la '${APP_DIR}/client/dist'
  printf '%s\n' '--- nginx site ---'
  sed -n '1,80p' /etc/nginx/conf.d/portfolio.conf
  printf '%s\n' '--- pm2 ---'
  pm2 status || true
  printf '%s\n' '--- pm2 recent out log ---'
  pm2 logs portfolio-server --lines 20 --nostream || true
  printf '%s\n' '--- pm2 recent error log ---'
  if [ -f /root/.pm2/logs/portfolio-server-error.log ]; then
    tail -n 20 /root/.pm2/logs/portfolio-server-error.log
  else
    echo 'no pm2 error log found'
  fi
  printf '%s\n' '--- nginx recent error log ---'
  if [ -f /var/log/nginx/error.log ]; then
    tail -n 40 /var/log/nginx/error.log
  else
    echo 'no nginx error log found'
  fi
  printf '%s\n' '--- root route ---'
  curl -k -I -sS -H 'Host: portfolio-tracker.app' https://127.0.0.1/
  printf '%s\n' '--- holdings route ---'
  curl -k -I -sS -H 'Host: portfolio-tracker.app' https://127.0.0.1/holdings
  printf '%s\n' '--- api me ---'
  curl -k -I -sS -H 'Host: portfolio-tracker.app' https://127.0.0.1/api/me
"
