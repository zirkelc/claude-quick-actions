# claude-quick-actions

A Claude Code mod that adds a row of buttons above the prompt. Each button runs a skill or slash command, sends or fills a prompt, or runs a shell command. The row also shows the git state of the working directory.

```
[ /pr ]  [ $ fetch ]  [ ★ review ]            * ↑2 main↓5  [ + ] [ ≡ ]
```

## Actions

Each action has one of four types:

| Type | What a press does |
| --- | --- |
| skill / command | Runs `/name args` at once, as if typed |
| send prompt | Sends the text to Claude at once |
| fill prompt box | Puts the text in the prompt box, to edit before sending |
| shell command | Runs the command with `sh -c` in the session's directory, without Claude; the output goes to the transcript |

Commands and prompts wait until the session is idle. Shell commands run at once.

An action can also have an icon, a color for that icon, and a digit hotkey. A digit presses the button from an empty prompt box.

## Usage

- **Add:** type the action in the prompt box (`/commit`, `! pnpm test` or a prompt), then press `+`. The form opens prefilled, with the type taken from the prefix.
- **Manage:** `≡` opens a pane with the actions in three sections: Commands, Prompts and Shell. When the pane is open, `≡` closes it. Press an action's label to edit it, `↑` and `↓` to move it within its section, and `✕` twice to delete it.
- **Esc** steps back: from an option list to the form, from the form to the list, then it closes the pane.
- **Bands:** the Settings box at the bottom of the list sets the layout. `one band` puts all actions in one row. `one band per section` gives Commands, Prompts and Shell a row each, marked with the section's symbol in its color: blue `/`, magenta `>` and cyan `$`. The pane marks its sections the same way. A section without actions gets no row, and the git state and `+` `≡` stay on the first row.

```
/ [ /pr ]  [ /commit ]                        * ↑2 main↓5  [ + ] [ ≡ ]
> [ ★ review ]
$ [ $ fetch ]
```

Actions and settings are kept in the mod's store, so every project shows the same buttons.

## Git state

The right side of the row shows `*` for uncommitted changes, `↑N ↓N` against the upstream branch, and `main↓N` for commits on the remote's default branch (`origin/HEAD`, else `origin/main` or `origin/master`) that HEAD does not have. The counts come from local refs, so they are as current as the last fetch. Git runs with `--no-optional-locks`, so a refresh never holds the index lock while Claude runs its own git commands. Outside a git repository the counts are left out and the actions still show.

## Install

Clone the repo and load it in every session through the `env` block of `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "~/Developer/claude-quick-actions"
  }
}
```

For one session only: `claude --plugin-dir ~/Developer/claude-quick-actions`.

Mods (plugins of function hooks) are an early-access feature of Claude Code. While it is turned off for an account, the mod does not load.

## Development

```sh
claude plugin validate .
claude plugin test .
```

Claude Code writes the API types to `.claude-plugin/types/` when it loads the mod; `tsconfig.json` extends them, so `tsc -p .` type-checks the mod after the first load.

## Limits

These come from the mod API:

- A button label is one plain string: no color and no styled parts. Colors show on the text beside a button.
- The terminal's dropdown takes no mouse clicks, so the form uses its own option lists.
- Text inputs are single-line. In the prompt field, Enter adds a line break, and Save saves.
- A filled `!` text stays a normal prompt; the prompt box cannot be put into shell mode. Use the shell type instead.
