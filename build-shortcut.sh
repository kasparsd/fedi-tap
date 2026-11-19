#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
if [[ $# -gt 1 || (${1:-} != "" && ${1:-} != --unsigned) ]]; then
  echo "Usage: $0 [--unsigned]" >&2
  exit 2
fi

stage=$(mktemp -d)
name="Open in Fediverse"
trap 'rm -f -- "$stage/fedi-tap.cherri" "$stage/${name}_unsigned.shortcut" "$stage/$name.shortcut"; rmdir -- "$stage"' EXIT
cp "$project_dir/fedi-tap.cherri" "$stage/fedi-tap.cherri"
cherri "$stage/fedi-tap.cherri" --skip-sign --no-ansi
plutil -lint "$stage/${name}_unsigned.shortcut"

if [[ ${1:-} == --unsigned ]]; then
  artifact=${name}_unsigned.shortcut
else
  artifact="$name.shortcut"
  if ! shortcuts sign --mode anyone --input "$stage/${name}_unsigned.shortcut" --output "$stage/$artifact"; then
    echo "Apple Shortcuts signing failed. Run this command from a logged-in macOS Terminal session." >&2
    exit 1
  fi
fi

cp "$stage/$artifact" "$project_dir/public/$artifact"
printf 'Built %s\n' "$project_dir/public/$artifact"
