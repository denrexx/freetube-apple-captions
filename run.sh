#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
node "$project_dir/build.cjs" --if-needed
installation=$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).installation' "$project_dir/build/metadata.json")
exec flatpak run "$installation" --app-path="$project_dir/build/app" --socket=x11 --nosocket=wayland io.freetubeapp.FreeTube --ozone-platform=x11 "$@"
