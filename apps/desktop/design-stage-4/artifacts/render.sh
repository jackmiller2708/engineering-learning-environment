#!/bin/sh
# usage: render.sh <outfile.png> <width> <height> <url>   (headless Firefox, throwaway profile)
P=$(mktemp -d)
firefox --headless --no-remote --profile "$P" --screenshot "$1" --window-size="$2,$3" "$4" >/dev/null 2>&1
rm -rf "$P"
