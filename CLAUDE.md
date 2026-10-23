# quick-actions

A Claude Code mod. The README describes what it does.

## Checks

Run `claude plugin validate .` and `claude plugin test .` after each change.

## Test in a live session

The tests do not show the layout. After a change to what the mod draws, test it in a live session:

1. Open a new terminal that runs Claude Code with the mod loaded from the folder you work in:

   ```
   claude --plugin-dir <path to this folder>
   ```

   This loads the files as they are in that folder, also changes that are not committed.

2. Tell the user that the terminal is open, and what to look at (for example: type `/quick-actions` to open the pane).

## Release

Claude Code runs the copy of the mod that it made at install time, not this folder. It updates that copy only when the `version` in `.claude-plugin/plugin.json` changes, not on each commit.

1. When a change touches the shipped files (`hooks`, `types`, `.claude-plugin`), raise `version` in `.claude-plugin/plugin.json`. CI fails when shipped files changed after the last version change.
2. Push to `main`.
3. Update the local installation:

   ```
   claude plugin update quick-actions@zirkelc
   ```

4. Tell the user to run `/reload-plugins`, so the running sessions load the new version.
