import type { ElementTable } from 'claude-code'

import type { CustomAction, Draft } from '../../types'
import type { Action } from '../actions'

/**
 * The element constructors the views draw with, from the table the render
 * hook resolves. The terminal and the desktop app have all of them; the
 * mobile app has no Input, so the pane does not draw there.
 */
export type Ui = Pick<ElementTable<'terminal' | 'desktop'>, 'Box' | 'Text' | 'Button' | 'Input'>

/** What the band's buttons do. */
export type BandHandlers = {
  run: (action: Action) => void
}

/** What the pane's buttons and inputs do. */
export type PaneHandlers = {
  close: () => void
  startAdd: () => void
  startEdit: (action: CustomAction) => void
  pressDelete: (action: CustomAction) => void
  moveEntry: (entry: string, step: -1 | 1) => void
  /** Takes an action or a new line off the band; an action stays in the list of all actions. */
  removeFromBand: (entry: string) => void
  /** Puts an action on the band, or takes it off. */
  togglePin: (id: string) => void
  run: (action: CustomAction) => void
  addNewline: () => void
  /** Resolves once the change is in the form's state, so a save after it sees it. */
  editDraft: (change: Partial<Draft>) => Promise<void>
  saveDraft: () => void
  leaveForm: () => void
}
