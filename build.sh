#!/usr/bin/env bash
# Собирает папку dist/ — только то, что нужно браузеру.
# Исходники (blender/, assets/video/raw/, .glb) на сервер не попадают.
set -e
cd "$(dirname "$0")"

rm -rf dist
mkdir -p dist/assets/video

cp index.html dist/
cp assets/app.js assets/voxel.js assets/models.js assets/style.css dist/assets/
cp assets/video/*.mp4 dist/assets/video/
cp _headers dist/ 2>/dev/null || true

echo "dist готов:"
du -sh dist
