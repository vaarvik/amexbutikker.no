#!/usr/bin/env bash
# Walks the booted iOS Simulator into a place, waits, and walks out again, so visit detection
# (docs/adr/0001-visit-detection.md) fires its geofence events.
#
#   pnpm simulate:visit "Burger King"        # dwell 30 s
#   pnpm simulate:visit "Burger King" 200    # dwell 200 s
#
# Needs: the API running (pnpm api), the app open with "Spør meg etter besøk" on, and the
# app's minimum dwell below the dwell here (EXPO_PUBLIC_VISIT_MIN_DWELL_SECONDS=20 in
# apps/mobile/.env.local, then restart Metro). The phone is left 700 m north of the place.
set -euo pipefail

name="${1:?usage: simulate-visit.sh <place name> [dwell seconds]}"
dwell="${2:-30}"
api="${API_URL:-http://localhost:3000}"

# The place nearest Oslo S with this name, from the API's own search.
read -r lat lng label < <(
  curl -fsS --get "$api/v1/places/search" \
    --data-urlencode "q=$name" --data-urlencode "lat=59.9111" --data-urlencode "lng=10.7528" |
    python3 -c '
import json, sys
results = [r for r in json.load(sys.stdin)["results"] if r["place"]["kind"] == "physical"]
if not results:
    sys.exit("no physical place found")
p = results[0]["place"]
print(p["location"]["lat"], p["location"]["lng"], p["name"])'
)
away_lat=$(python3 -c "print(round($lat + 0.0063, 6))")

step() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$1"; }

step "outside: 700 m from $label"
xcrun simctl location booted set "$away_lat,$lng"
sleep 8
step "walking in to $label ($lat,$lng)"
xcrun simctl location booted set "$lat,$lng"
step "inside for $dwell s"
sleep "$dwell"
step "walking out"
xcrun simctl location booted set "$away_lat,$lng"
step "done; a question should appear within a few seconds"
