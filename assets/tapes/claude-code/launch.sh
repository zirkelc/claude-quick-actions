#!/bin/sh
# Starts Claude Code in the sample repository of the demo home, with the mod
# from this checkout, and none of the real home's settings, plugins, MCP
# servers, CLAUDE.md or memory. Run reset.sh first.
# The session runs in the default permission mode with read-only tools allowed.
# The demo settings turn on the sandbox, which runs the shell commands of the
# /code-review agent with no prompt. Anything else would stop at a permission prompt.
TAPES=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$TAPES/../../.." && pwd)
DEMO_HOME=$(cd "${QUICK_ACTIONS_DEMO_HOME:-/tmp/quick-actions-demo}" && pwd -P) || exit 1

cd "$DEMO_HOME/Developer/my-awesome-lib" || exit 1
clear
exec env -i HOME="$DEMO_HOME" USER="$USER" LOGNAME="$LOGNAME" PATH="$PATH" TERM="$TERM" \
  LANG=en_US.UTF-8 SHELL=/bin/zsh TMPDIR="$TMPDIR" \
  DISABLE_AUTOUPDATER=1 \
  claude --plugin-dir "$REPO" \
    --strict-mcp-config \
    --permission-mode default \
    --allowedTools Read Grep Glob "Bash(git diff:*)" "Bash(git status:*)" "Bash(git log:*)" \
    "$@"
