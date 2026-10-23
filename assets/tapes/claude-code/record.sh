#!/bin/sh
# Records the README images: the live take, sped up where the model works, and
# its screenshots, in a macOS window on GitHub's page background. A dark theme
# goes on the dark page, and a theme whose name ends in -light on the light
# page. Each take is one model turn on the account that Claude Code is logged
# in with.
#
#   ./record.sh             both README sets: graphite-dark (dark) and graphite-light (light)
#   ./record.sh <theme>     one theme: a file in settings/
#
# TITLE sets the window title (default: quick-actions). Writes to out/<theme>/.
set -eu
cd "$(dirname "$0")"
if [ $# -eq 0 ]; then
  ./record.sh graphite-dark
  exec ./record.sh graphite-light
fi
theme=$1
title=${TITLE:-quick-actions}
frame=../frame/frame.sh
[ -f "settings/$theme.tape" ] || { echo "no theme settings/$theme.tape" >&2; exit 2; }
cp "settings/$theme.tape" .theme.tape
printf '%s\n' "$theme" > .theme-name
case $theme in *-light) mode=light ;; *) mode=dark ;; esac
mkdir -p out "out/$theme"

# Plays the part from <start> seconds to <tail> seconds before the end 5 times
# faster: there, the model works. What comes after the turn has fixed waits,
# so its length is known. Then puts the take in its window, as MP4 and GIF.
finish() {
  name=$1 start=$2 tail=$3
  duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "out/$name-raw.mp4")
  end=$(awk -v d="$duration" -v t="$tail" 'BEGIN { printf "%.1f", d - t }')
  ffmpeg -v error -y -i "out/$name-raw.mp4" -filter_complex \
    "[0:v]trim=0:$start,setpts=PTS-STARTPTS[a];[0:v]trim=$start:$end,setpts=(PTS-STARTPTS)/5[b];[0:v]trim=$end,setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1:a=0,format=yuv420p[v]" \
    -map "[v]" -c:v libx264 -crf 18 -preset slow -movflags +faststart "out/$theme/$name-plain.mp4"
  "$frame" "out/$theme/$name-plain.mp4" "out/$theme/$name-$mode.mp4" "$mode" "$title" "$mode"
  "$frame" "out/$theme/$name-plain.mp4" "out/$theme/$name-$mode.gif" "$mode" "$title" "$mode"
  mv "out/$name-raw.mp4" "out/$theme/$name-raw.mp4"
}

vhs quick-actions.tape
finish quick-actions 10 10.5
for png in out/*.png; do
  base=$(basename "$png" .png)
  "$frame" "$png" "out/$theme/$base-$mode.png" "$mode" "$title" "$mode"
  mv "$png" "out/$theme/$base-plain.png"
done
ls -la "out/$theme"
