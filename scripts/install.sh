#!/usr/bin/env sh
set -eu
cp -n .env.example .env || true
echo "Set POSTGRES_PASSWORD, ADMIN_PASSWORD, SESSION_SECRET, ENCRYPTION_KEY, and RUNNER_SHARED_SECRET in .env."
echo "Then run: docker compose up -d --build"
