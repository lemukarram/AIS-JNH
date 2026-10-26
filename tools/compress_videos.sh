#!/usr/bin/env bash
# Compress stock clips for the demo: 720p, H.264, muted, +faststart, ~3 MB each. Needs ffmpeg on your laptop.
# Usage: tools/compress_videos.sh raw_clips/ assets/video/
set -euo pipefail
in="${1:-raw_clips}"; out="${2:-assets/video}"; mkdir -p "$out"; i=1
for f in "$in"/*.{mp4,mov,mkv}; do
  [ -e "$f" ] || continue
  ffmpeg -y -i "$f" -t 40 -vf "scale=-2:720,fps=25" -c:v libx264 -preset slow -crf 28 -maxrate 700k -bufsize 1400k -an -movflags +faststart "$out/cam$i.mp4"
  i=$((i+1))
done
echo "Wrote $((i-1)) clips to $out. Keep a copy as source_videos/ for tools/bake_tracks.py."
