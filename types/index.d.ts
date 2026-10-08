export type CustomKind = 'command' | 'submit' | 'fill' | 'shell'

/** An action the person added with the plus button, kept across sessions. */
export type CustomAction = {
  id: string
  label: string
  /** One digit, or empty for none. */
  hotkey: string
  kind: CustomKind
  /** A color name for the button, e.g. `green`; empty for the terminal's default. */
  color: string
  /**
   * Without its prefix: `name args` for a command, the shell command line for
   * shell, the prompt text otherwise.
   */
  text: string
}

/** The form of the add and edit view. `id` is set when an existing action is edited; saving or leaving returns to the list. */
export type Draft = Omit<CustomAction, 'id'> & {
  id: string | null
  /** Why the last save was refused, shown in the form until the next change. */
  error: string | null
  /** The setting whose option list is open in place of the form, or null for the form. */
  picking: DraftSetting | null
}

/** The settings of the form that are picked from a list. */
export type DraftSetting = 'kind' | 'color' | 'hotkey'

declare module 'claude-code' {
  interface PluginState {
    'quick-actions': {
      custom: Array<CustomAction>
      draft: Draft | null
      /** The custom action whose delete button was pressed once and waits for the second press. */
      pendingDelete: string | null
      /** Whether the pane is open and drawn; a pane that waits undrawn counts as closed. */
      isPaneOpen: boolean
      /** Whether the band shows the pane's views, because the pane was opened without room to draw it. */
      isPaneInBand: boolean
      /** The band from left to right and top to bottom: action ids, and new line entries that start the next row. */
      order: Array<string>
    }
  }
}
