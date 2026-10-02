/** The git state of the session's working directory, as the band draws it. */
export type GitState = {
  /** Branch name, or null for a detached HEAD. */
  branch: string | null
  /** Short commit id of HEAD. */
  sha: string
  /** Name of the linked worktree's root folder, or null in the main worktree. */
  worktree: string | null
  /** Any tracked change or untracked file. */
  isDirty: boolean
  /** Upstream branch, e.g. `origin/feat-x`, or null without one. */
  upstream: string | null
  ahead: number
  behind: number
  /** Remote default branch, e.g. `origin/main`, or null when none is known. */
  base: string | null
  /** Commits on the base branch that HEAD does not have, 0 when the base is the upstream. */
  baseBehind: number
}

export type CustomKind = 'command' | 'submit' | 'fill' | 'shell'

/** An action the person added with the plus button, kept across sessions. */
export type CustomAction = {
  id: string
  label: string
  /** One digit, or empty for none. */
  hotkey: string
  kind: CustomKind
  /** An optional symbol drawn before the label, e.g. `$`; empty for none. */
  icon: string
  /** A color name for the icon, e.g. `green`; empty for the terminal's default. */
  color: string
  /**
   * Without its prefix: `name args` for a command, the shell command line for
   * shell, the prompt text otherwise.
   */
  text: string
}

/**
 * The form of the add and edit view. `id` is set when an existing action is
 * edited; `source` is the prompt box text a new action was made from;
 * `returnTo` is where saving or cancelling leads: back to the list, or the pane
 * closes because the form was opened from the band.
 */
export type Draft = Omit<CustomAction, 'id'> & {
  id: string | null
  source: string | null
  returnTo: 'band' | 'list'
  /** Why the last save was refused, shown in the form until the next change. */
  error: string | null
  /** The setting whose option list is open in place of the form, or null for the form. */
  picking: DraftSetting | null
}

/** The settings of the form that are picked from a list. */
export type DraftSetting = 'kind' | 'icon' | 'color' | 'hotkey'

declare module 'claude-code' {
  interface PluginState {
    'quick-actions': {
      git: GitState | null
      custom: Array<CustomAction>
      draft: Draft | null
      /** The custom action whose delete button was pressed once and waits for the second press. */
      pendingDelete: string | null
    }
  }
}
