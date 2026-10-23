# Claude Code recordings

The tape in this folder records the GIF at the top of the [README](../../../README.md) and the pane screenshot under Usage with [vhs](https://github.com/charmbracelet/vhs). It is a live take in a sample repository with an uncommitted change. Hotkey `1` runs `git fetch`. Hotkey `3` fills the prompt box with a saved prompt, and `Esc` `Esc` clears it. Hotkey `2` runs the built-in `/code-review` skill, which reviews the diff in a background agent, and Claude sums up the findings. Then `/quick-actions` opens the pane beside the chat.

## Record

```sh
./record.sh               # both README sets: Graphite Dark and Graphite Light
./record.sh <name>        # one theme: settings/<name>.tape
```

It needs `vhs`, `ttyd`, `ffmpeg`, `git`, Google Chrome (for the window frame) and Claude Code with a login. It takes about 1.5 minutes for each theme: one `/code-review` run (a background agent of about 20 seconds, and the main turn that sums it up, about 35 seconds in all), on the account that Claude Code is logged in with. Each take is different, so look at the results before you use them, and run again if you do not like one.

The results go to `out/<theme>/`:

| File | What it shows |
| --- | --- |
| `quick-actions-dark.gif`, `quick-actions-light.gif` (and `.mp4`) | The README GIF, in its window |
| `quick-actions-raw.mp4`, `quick-actions-plain.mp4` | The take at normal speed, and sped up with no window |
| `quick-actions-done-*.png` | The finished review, before the pane opens |
| `quick-actions-pane-*.png` | The pane beside the chat: the README screenshot |

The dark theme (`graphite-dark`) gives the `-dark` files, and the light theme (`graphite-light`) the `-light` files. The screenshots also come as `-plain`, with no window. To use them, copy `quick-actions-<mode>.gif` and `quick-actions-pane-<mode>.png` to `assets/`. The README shows the version that matches the reader's GitHub theme.

## How it works

- **Demo home.** `reset.sh` builds a new home folder in `/tmp/quick-actions-demo` (set `QUICK_ACTIONS_DEMO_HOME` to use another one) from `fixture/`: the sample repository in `~/Developer/my-awesome-lib` with three commits, a bare copy in `~/remote` as its `origin` (so `git fetch` has a remote), and the uncommitted change from `fixture/changes/`, and the saved actions from `fixture/actions.json`. The takes run Claude Code and the shell with this folder as `HOME`, so the real home is never read or changed.
- **Saved actions.** A plugin loaded with `--plugin-dir` keeps its store in `~/.claude/plugins/store/quick-actions_inline-<hash>.json`, where the hash is the first 12 hex digits of the SHA-256 of `quick-actions@inline`. `reset.sh` copies `fixture/actions.json` there: four actions, all on the band: one shell command (`git fetch`), one skill (`/code-review`) and two prompts.
- **Login.** Claude Code finds its login on macOS in the login keychain under `~/Library/Keychains`, and elsewhere in `~/.claude/.credentials.json`. `reset.sh` links that one item into the demo home. The keychain entry is under the real user name, so `launch.sh` keeps `USER`.
- **Claude Code state.** `reset.sh` writes the demo home's `~/.claude.json` (onboarding done, the sample repository trusted, a pane width of 84 columns, and the notices, hints and promos of a new install marked as seen) and `~/.claude/settings.json` (the fullscreen renderer, which puts the pane beside the chat, no prompt suggestions, and the sandbox with `autoAllowBashIfSandboxed`, which runs the shell commands of the `/code-review` agent with no permission prompt, with writes only in the sample repository and no network). If a new version of Claude Code shows a new notice on the start screen, find its key in a `~/.claude.json` that has seen it, and add it to `reset.sh`.
- **Launch.** `launch.sh` starts Claude Code in the sample repository with a clean environment, the mod from this checkout (`--plugin-dir` at the repository root), no MCP servers, and the default permission mode with read-only tools allowed (`Read`, `Grep`, `Glob`, `git diff`, `git status`, `git log`). Auto mode would also do, but the sandbox keeps the take from changing anything outside the sample repository.
- **Speed.** `record.sh` plays the part where the model works 5 times faster. It starts 10 seconds into the take, after the `/code-review` press, and ends 10.5 seconds before the end, because everything after the turn has fixed waits. If a later version of Claude Code changes these times, find the new ones on frames of the raw take and change the numbers in `record.sh`.
- **Look.** `settings/<theme>.tape` sets the font, the size (1800×1000, wide enough for the pane beside the chat) and the theme. Each theme has the background of a plugin pane in Claude Code's dark or light theme, so the pane and the terminal have one color. For a theme whose name ends in `-light`, `reset.sh` also sets Claude Code's own theme to light.
- **Window.** `record.sh` puts each output into a window with [`../frame/frame.sh`](../frame): a macOS title bar with a title (`TITLE`, default `quick-actions`), rounded corners and a margin of 24 pixels in GitHub's dark (`#0d1117`) or light (`#ffffff`) page color.
- **Fixture.** The `git fetch` action uses `--quiet`: the transcript draws the line breaks of a command's output as one line, and the output would also show the remote's path in `/tmp`. The band has no yellow action, because the text on a yellow button does not read.
