#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
if [[ $# -gt 1 || (${1:-} != "" && ${1:-} != --unsigned) ]]; then
  echo "Usage: $0 [--unsigned]" >&2
  exit 2
fi

stage=$(mktemp -d)
trap 'rm -f -- "$stage/FediTap.cherri" "$stage/FediTap_unsigned.shortcut" "$stage/FediTap.shortcut"; rmdir -- "$stage"' EXIT
cp "$project_dir/FediTap.cherri" "$stage/FediTap.cherri"
cherri "$stage/FediTap.cherri" --skip-sign --no-ansi
plutil -lint "$stage/FediTap_unsigned.shortcut"

if [[ ${1:-} == --unsigned ]]; then
  artifact=FediTap_unsigned.shortcut
else
  artifact=FediTap.shortcut
  if ! shortcuts sign --mode anyone --input "$stage/FediTap_unsigned.shortcut" --output "$stage/$artifact"; then
    echo "Apple Shortcuts signing failed. Run this command from a logged-in macOS Terminal session." >&2
    exit 1
  fi
fi

cp "$stage/$artifact" "$project_dir/$artifact"
printf 'Built %s\n' "$project_dir/$artifact"
