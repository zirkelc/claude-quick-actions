/** One pane for the list of actions and the form that adds or edits one. */
export const PANE = 'quick-actions'

/** Panes that earlier versions opened; nothing draws them any more. */
export const LEGACY_PANES = ['quick-actions-edit', 'quick-actions-manage']

export const PANE_OPTIONS = { id: PANE, title: 'Quick actions', focus: true, closeOnEscape: true, holdToasts: true, rows: 20 } as const

/** Keys in the store, which keeps the person's actions and their order across sessions. */
export const STORE_ACTIONS = 'actions'
export const STORE_ORDER = 'order'

/** The slash command that opens or closes the pane, also when the band is hidden. */
export const COMMAND = { name: 'quick-actions', description: 'Open or close the quick actions pane' } as const

/** What a press or a command answers when the pane is open but not drawn; the band draws it instead. */
export const PANE_IN_BAND_TEXT = 'The quick actions pane has no room here, so the band above the prompt shows it.'

/** Why Esc did not close the pane: it stepped back one view instead. */
export const STEP_BACK_REASON = 'back one view'
