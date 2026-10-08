<div align='center'>

<picture>
  <img src="assets/quick-actions.png" alt="A Claude Code session with the quick actions band above the prompt: git pull, review diff, /commit and /release as colored buttons" width="800" />
</picture>

<h1 align="center">Quick Actions </h1>

<p align="center">One-click buttons above the Claude Code prompt for the skills, prompts and shell commands you run all the time</p>
<p align="center">
  <a href="LICENSE" alt="License"><img src="https://img.shields.io/github/license/zirkelc/claude-quick-actions"></a>
</p>

</div>

`git pull`, "review the diff", `/commit`, `/release`: things you type ten times a day become one click. Save an action once, pin it to the band, and press it. Actions you use less often stay in a list, one click away from the band.

quick-actions is a [Claude Code mod](https://code.claude.com/docs/en/plugins): a plugin of function hooks that draws its own UI inside Claude Code.

## Features

- **Four types of action:** call a skill or slash command, send a prompt, fill the prompt box to edit before sending, or run a shell command.
- **A band you arrange:** pin the actions you want, set their order, and split them over several rows.
- **Colors and hotkeys:** give an action a color, and a digit that presses it from an empty prompt box.
- **More actions than the band shows:** unpinned actions stay in the list, where `▶` runs them.
- **Plays well with other mods:** the band draws above the bands of other mods, and draws nothing when no action is pinned.
- **Same actions everywhere:** actions are kept in the mod's store, so every project and session shows them.

## Requirements

Claude Code 2.1.287 or later, where mods load by default.

## Install

```sh
claude plugin marketplace add zirkelc/claude-quick-actions
claude plugin install quick-actions@claude-quick-actions --scope user
```

To try it for one session without installing:

```sh
git clone https://github.com/zirkelc/claude-quick-actions.git
claude --plugin-dir ./claude-quick-actions
```

To uninstall: `claude plugin uninstall quick-actions@claude-quick-actions`.

## Usage

Type `/quick-actions` to open the pane, and again to close it. The pane has two lists.

**Actions** lists every saved action:

| Control | What it does |
| --- | --- |
| label | Opens the action's form |
| `☆` / `★` | Pins the action to the band, or takes it off |
| `▶` | Runs the action now |
| `✕` | Deletes the action (press twice) |
| `+ Add action` | Opens the form for a new action |

**Band** lists what the band shows, in order. Each entry has `↑` `↓` to move it and `-` to take it off the band. `+ Add new line` adds a `↵ new line` entry: the entries after it go on the next row of the band.

**The form** sets the action's type (Call Skill, Fill Prompt, Send Prompt or Run Shell), its color, its hotkey, its label and its text. The preview shows the button as the band draws it. `← Back` and Esc go back one step; `✕ Close` closes the pane.

| Type | What a press does |
| --- | --- |
| Call Skill | Runs `/name args` at once, as if typed |
| Fill Prompt | Puts the text in the prompt box, to edit before sending |
| Send Prompt | Sends the text to Claude at once |
| Run Shell | Runs the command with `sh -c` in the session's directory, without Claude; the output goes to the transcript |

Skills and prompts wait until Claude is idle. Shell commands run at once.

## What it can access

`claude plugin validate` reports these calls on the engine; nothing else is read, written or sent:

- **Store:** your actions and the band order, under the mod's own keys (`$.store`).
- **Processes:** only the shell commands you save as Run Shell actions, when you press them (`$.process.run`).
- **Prompt and commands:** filling or sending the prompt, and running slash commands, when you press an action (`$.prompt`, `$.command`).
- **UI:** the band, the pane, toasts and transcript lines (`$.ui`).
- **Session state and a timer:** what the pane shows (`$.state`), and a timer that reads the saved actions again every 15 seconds, so actions saved in another session show up (`$.clock`).

It makes no network calls and reads no files.

## Limits

These come from the mod API:

- A button label is one plain string, so a colored button keeps the terminal's text color. Light colors (yellow, white) read best with a light terminal theme.
- A digit hotkey only works for an action on the band, and the band shows it before the label (`1: commit`).
- Text inputs are single-line. In the text field, Enter adds a line break, and Save saves.
- A filled `!` text stays a normal prompt; the prompt box cannot be put into shell mode. Use Run Shell instead.

## Development

```sh
claude plugin validate .
claude plugin test .
```

To load your checkout in every session, add it to the `env` block of `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "~/Developer/claude-quick-actions"
  }
}
```

Claude Code writes the API types to `.claude-plugin/types/` when it loads the mod, and `tsconfig.json` extends them, so `tsc -p .` type-checks the mod after the first load.

`hooks/register.tsx` holds the hooks, the state and every call on the engine, because the mod API follows the engine interface only into functions of the same file. The rest is pure: `hooks/actions.ts` (the action model and the band order) and `hooks/views/` (the band, the list and the form). Each file under `tests/` covers the file of the same name under `hooks/`.

The image at the top is `assets/screenshot.html`, rendered in a browser at 2x.

## License

[MIT](LICENSE)
