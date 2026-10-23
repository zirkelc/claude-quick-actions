# The README image: the band of saved actions above the prompt. Hotkey 1 runs
# git fetch. Hotkey 3 fills the prompt box with a saved prompt, and Esc clears
# it again. Hotkey 2 runs the /code-review skill on the uncommitted diff of the
# sample repository. Then /quick-actions opens the pane beside the chat.
Output out/quick-actions-raw.mp4
Source .theme.tape
# The terminal only. The window frame is added afterwards.
Set Width 1800
Set Height 1000

Hide
Type "clear && ./reset.sh && export HOME=$(cd /tmp/quick-actions-demo && pwd -P) && ./launch.sh"
Enter
Wait+Screen@60s /4: explain diff/
Sleep 2s
Show

Sleep 2s
# Run Shell: the command runs without Claude, and its line goes to the transcript.
Type "1"
Wait+Screen@20s /git fetch --prune --quiet/
Sleep 2s

# Fill Prompt: the text goes into the prompt box, to edit before sending.
Type "3"
Wait+Screen@10s /Write vitest tests/
Sleep 2500ms
Escape
Sleep 300ms
Escape
Sleep 1500ms

# Call Skill: the skill runs at once, as if typed.
Type "2"
Wait+Screen@20s /code-review/
# The skill runs as a background agent. Its result comes back to the main
# turn, which ends with the summary.
Wait+Screen@600s /Agent "\/code-review" finished/
Wait+Screen@300s /· done /
Sleep 3s
Screenshot out/quick-actions-done.png

Type "/quick-actions"
Sleep 500ms
Enter
Wait+Screen@20s /on the band/
Sleep 4s
Screenshot out/quick-actions-pane.png
Sleep 1s
