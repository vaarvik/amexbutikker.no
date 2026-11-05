#!/usr/bin/env bash
# Exposes the local API and a web build through two Cloudflare quick tunnels, so phones and
# browsers outside this network can use them. Quick tunnels need no Cloudflare account; their
# URLs are random and change on every run.
#
#   pnpm tunnel            # Ctrl-C stops everything
#
# What it does, in order (the web build needs the API URL, the API needs the web URL for CORS):
#   1. opens a tunnel to the API port and one to the web port, and reads both URLs;
#   2. builds and starts the API on 0.0.0.0 with CORS_ORIGINS set to the web tunnel URL;
#   3. exports the web app with EXPO_PUBLIC_API_URL set to the API tunnel URL and serves it.
# The database must be running (pnpm db:up) and migrated.
set -euo pipefail

cd "$(dirname "$0")/.."
API_PORT="${PORT:-3000}"
WEB_PORT="${WEB_PORT:-8082}"
LOG_DIR="$(mktemp -d)"
PIDS=()

cleanup() {
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  rm -rf "$LOG_DIR"
}
trap cleanup EXIT INT TERM

if ! command -v cloudflared >/dev/null; then
  echo "cloudflared is not installed: brew install cloudflared" >&2
  exit 1
fi

# Starts a quick tunnel to a local port and prints its public URL once Cloudflare assigns it.
open_tunnel() {
  local port="$1" log="$LOG_DIR/tunnel-$1.log"
  cloudflared tunnel --no-autoupdate --url "http://localhost:$port" >"$log" 2>&1 &
  PIDS+=("$!")
  for _ in $(seq 1 60); do
    local url
    url="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$log" | head -n 1 || true)"
    if [ -n "$url" ]; then
      echo "$url"
      return 0
    fi
    sleep 1
  done
  echo "No tunnel URL for port $port after 60 s; see $log" >&2
  return 1
}

echo "Opening tunnels …"
API_URL="$(open_tunnel "$API_PORT")"
WEB_URL="$(open_tunnel "$WEB_PORT")"

echo "Starting the API on 0.0.0.0:$API_PORT …"
pnpm exec tsc -b apps/api
HOST=0.0.0.0 PORT="$API_PORT" TRUST_PROXY=true \
  CORS_ORIGINS="$WEB_URL,http://localhost:8081,http://localhost:$WEB_PORT" \
  node --env-file-if-exists=.env apps/api/dist/src/server.js &
PIDS+=("$!")

echo "Exporting the web app against $API_URL …"
(cd apps/mobile && EXPO_PUBLIC_API_URL="$API_URL" pnpm exec expo export --platform web >/dev/null)
(cd apps/mobile && pnpm exec expo serve --port "$WEB_PORT" >/dev/null) &
PIDS+=("$!")

cat <<EOF

  API  $API_URL
  Web  $WEB_URL

  Expo Go on a phone, against the tunnelled API:
    EXPO_PUBLIC_API_URL=$API_URL pnpm mobile

  Ctrl-C stops the tunnels, the API and the web server.
EOF
wait
