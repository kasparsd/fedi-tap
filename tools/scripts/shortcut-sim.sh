#!/usr/bin/env bash
# Prepare the ⁂tap Shortcut for testing in the iOS Simulator against the mock server.
#
#   tools/scripts/shortcut-sim.sh [--page URL] [--device NAME|UDID] [--port N] [--name NAME]
#   tools/scripts/shortcut-sim.sh stop
#
# It compiles a copy of fedi-tap.cherri whose `page` is the local dev server (default
# https://localhost:8443/), signs it, serves it from a throwaway HTTP server and opens it in
# the simulator's Safari, which downloads it. The repo's own Shortcut is never touched.
# The remaining steps are taps in the simulator; see "Test the Shortcut in the iOS Simulator"
# in docs/development.md. Needs a Mac with Xcode, Cherri, mkcert and a booted simulator.
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
work="$project_dir/.local/shortcut-sim"
pidfile="$work/server.pid"

stop_server() {
  if [[ -f $pidfile ]]; then
    kill "$(cat "$pidfile")" 2>/dev/null || true
    rm -f "$pidfile"
  fi
}

if [[ ${1:-} == stop ]]; then
  stop_server
  echo "Stopped the Shortcut file server."
  exit 0
fi

page="https://localhost:8443/"
device=booted
port=8999
name=tapdev
while [[ $# -gt 0 ]]; do
  case $1 in
    --page) page=$2; shift 2 ;;
    --device) device=$2; shift 2 ;;
    --port) port=$2; shift 2 ;;
    --name) name=$2; shift 2 ;;
    *) echo "Usage: $0 [--page URL] [--device NAME|UDID] [--port N] [--name NAME] | stop" >&2; exit 2 ;;
  esac
done
[[ $page == */ ]] || page="$page/"

for tool in cherri shortcuts xcrun python3; do
  command -v "$tool" >/dev/null || { echo "Missing $tool." >&2; exit 1; }
done
xcrun simctl list devices booted | grep -q Booted || {
  echo "No booted simulator. Run: xcrun simctl boot <device>" >&2
  exit 1
}

stop_server
rm -rf "$work"
mkdir -p "$work/srv"

# Same source, other page and name. The name must stay ASCII-safe for the output filename.
sed -e "s#^const page = .*#const page = \"$page\"#" \
  -e "s#^\#define name .*#\#define name $name#" \
  "$project_dir/fedi-tap.cherri" >"$work/$name.cherri"
cherri "$work/$name.cherri" --skip-sign --no-ansi
if ! shortcuts sign --mode anyone --input "$work/${name}_unsigned.shortcut" --output "$work/srv/$name.shortcut"; then
  echo "Apple Shortcuts signing failed. Run this from a logged-in macOS Terminal session." >&2
  exit 1
fi

# The page is HTTPS, so the simulator has to trust the mkcert root the dev server uses.
if [[ $page == https://localhost* ]] && command -v mkcert >/dev/null; then
  xcrun simctl keychain "$device" add-root-cert "$(mkcert -CAROOT)/rootCA.pem"
fi

(cd "$work/srv" && nohup python3 -m http.server "$port" --bind 127.0.0.1 >"$work/server.log" 2>&1 & echo $! >"$pidfile")
sleep 1
xcrun simctl openurl "$device" "http://127.0.0.1:$port/$name.shortcut"

cat <<EOF
Built and opened $name.shortcut (page: $page) in the simulator.
Next, in the simulator: Download > Downloads (the toolbar icon) > tap $name > Add Shortcut.
Then Safari > Share > $name (under View More). Stop the file server with: $0 stop
EOF
