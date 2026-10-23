#!/bin/sh
# Builds the demo home from the fixture. The takes run Claude Code with this
# folder as HOME, so ~/Developer/my-awesome-lib in the recordings is a demo
# folder, and nothing of the real home shows or changes.
set -eu
TAPES=$(cd "$(dirname "$0")" && pwd)
DEMO_HOME=${QUICK_ACTIONS_DEMO_HOME:-/tmp/quick-actions-demo}

# What the last take left goes to the trash where there is one.
if [ -e "$DEMO_HOME" ]; then
  if command -v trash >/dev/null 2>&1; then trash "$DEMO_HOME"; else rm -rf "$DEMO_HOME"; fi
fi
mkdir -p "$DEMO_HOME"
# The physical path, so Claude Code and the shell agree on it (on macOS, /tmp is /private/tmp).
DEMO_HOME=$(cd "$DEMO_HOME" && pwd -P)
LIB="$DEMO_HOME/Developer/my-awesome-lib"

# The login: on macOS, Claude Code reads it from the login keychain, which it
# finds under ~/Library. Elsewhere it is in ~/.claude/.credentials.json.
if [ -d "$HOME/Library/Keychains" ]; then
  mkdir -p "$DEMO_HOME/Library"
  ln -s "$HOME/Library/Keychains" "$DEMO_HOME/Library/Keychains"
fi
mkdir -p "$DEMO_HOME/.claude"
if [ -f "$HOME/.claude/.credentials.json" ]; then
  ln -s "$HOME/.claude/.credentials.json" "$DEMO_HOME/.claude/.credentials.json"
fi

# Claude Code's own state: onboarding done, the sample repository trusted, a
# pane width that leaves room for the chat, and every notice, hint and upsell
# marked as seen, so the start screen shows only the header.
# Claude Code's own theme follows the terminal theme: light for a theme in
# settings/ whose name ends in -light (record.sh writes the name to .theme-name).
case $(cat "$TAPES/.theme-name" 2>/dev/null) in *-light) claude_theme=light ;; *) claude_theme=dark ;; esac
version=$(claude --version | cut -d' ' -f1)
cat > "$DEMO_HOME/.claude.json" <<JSON
{
  "hasCompletedOnboarding": true,
  "lastOnboardingVersion": "$version",
  "lastReleaseNotesSeen": "$version",
  "theme": "$claude_theme",
  "autoUpdates": false,
  "fullscreenUpsellSeenCount": 3,
  "autoPermissionsNotificationCount": 3,
  "hasSeenAutoDefaultNotice": true,
  "promoStartupSeenCount": 3,
  "effortCalloutV2Dismissed": true,
  "passesUpsellSeenCount": 4,
  "passesLastSeenRemaining": 3,
  "remoteControlUpsellSeenCount": 3,
  "remoteDialogSeen": true,
  "pushNotifUpsellSeenCount": 3,
  "rcLongTurnNudgeSeenCount": 5,
  "rcLongTurnNudgeSeenKey": "v1",
  "hasSeenTasksHint": true,
  "ideHintShownCount": 5,
  "lspRecommendationIgnoredCount": 2,
  "hasSeenAutoModeEntryWarning": true,
  "numStartups": 100,
  "lastClawdEntranceVersion": "$version",
  "announcementImpressions": { "opus-5-5-launch": 10, "opus-5-5-update": 3, "fable-5-1-launch": 5 },
  "projects": { "$LIB": { "hasTrustDialogAccepted": true } },
  "pluginPanes": { "dockColumns": 84 }
}
JSON
# The fullscreen renderer puts a plugin pane beside the chat. The sandbox runs
# the shell commands of the /code-review agent with no permission prompt, but
# limits their writes to the sample repository and gives them no network.
cat > "$DEMO_HOME/.claude/settings.json" <<'JSON'
{
  "tui": "fullscreen",
  "promptSuggestionEnabled": false,
  "sandbox": { "enabled": true, "autoAllowBashIfSandboxed": true }
}
JSON

# The saved actions and the band order. A plugin loaded with --plugin-dir
# keeps its store in a file named after "<name>@inline".
store="$DEMO_HOME/.claude/plugins/store"
hash=$(printf '%s' 'quick-actions@inline' | shasum -a 256 | cut -c1-12)
mkdir -p "$store"
cp "$TAPES/fixture/actions.json" "$store/quick-actions_inline-$hash.json"

# The sample repository: three commits, a remote, then the uncommitted change
# from fixture/changes that the actions look at.
mkdir -p "$LIB"
cp -R "$TAPES/fixture/my-awesome-lib/." "$LIB/"
git -C "$LIB" init -q -b main
commit() {
  GIT_AUTHOR_DATE=$1 GIT_COMMITTER_DATE=$1 \
    git -C "$LIB" -c user.name=Demo -c user.email=demo@example.com commit -q --allow-empty -m "$2"
}
git -C "$LIB" add package.json
commit 2026-09-22T09:00:00Z 'chore: initial package'
git -C "$LIB" add -A
commit 2026-09-23T10:30:00Z 'feat: retry helper'
commit 2026-09-29T15:45:00Z 'docs: describe retry options'
# A bare copy in the demo home is the remote, so the git fetch action has one.
git clone -q --bare "$LIB" "$DEMO_HOME/remote/my-awesome-lib.git"
git -C "$LIB" remote add origin "$DEMO_HOME/remote/my-awesome-lib.git"
git -C "$LIB" fetch -q origin
git -C "$LIB" branch -q -u origin/main
cp -R "$TAPES/fixture/changes/." "$LIB/"
