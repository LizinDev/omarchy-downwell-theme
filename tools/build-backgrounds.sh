#!/bin/bash
# Rebuild backgrounds/ from colors.toml. The sprite scenes need the Downwell
# project (~/Projects/Downwell) and the installed Steam game; the dither one
# needs nothing. Usage: tools/build-backgrounds.sh [clouds-source.png]
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
theme=$(dirname "$here")
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
build() { python3 -I "$here/$1" "${@:3}" "$tmp/out.png" && magick "$tmp/out.png" "PNG8:$theme/backgrounds/$2"; }
if [[ -n ${1:-} ]]; then
  python3 -I "$here/recolor.py" "$1" "$tmp/out.png" && magick "$tmp/out.png" "PNG8:$theme/backgrounds/1-clouds.png"
fi
build well.py 2-well.png
build title.py 3-title.png
build dither.py 4-dither.png
build bros.py 5-bros.png
build terra.py 6-terra.png
build isaac.py 7-isaac.png
ls -la "$theme/backgrounds"
