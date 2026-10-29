#!/bin/sh
# Renders store/header.html at the App Store header sizes with headless Chrome.
# Usage: sh scripts/render-store-header.sh [output folder]   (default: ~/Desktop/App Store assets)
set -e
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="${1:-$HOME/Desktop/App Store assets}"
mkdir -p "$OUT"

render() { # width height file (rendered at 2x)
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size="$(($1 / 2)),$(($2 / 2))" --screenshot="$OUT/$3" "file://$PWD/store/header.html" 2>/dev/null
  sips -g pixelWidth -g pixelHeight "$OUT/$3" | tail -2 | tr -s ' \n' ' '
  echo "→ $OUT/$3"
}

render 5244 2950 "header-5244x2950.png"
render 3840 1646 "header-3840x1646.png"
