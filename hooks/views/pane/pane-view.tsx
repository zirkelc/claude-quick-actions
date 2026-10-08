import type { RenderElement } from 'claude-code'

import type { CustomAction, Draft } from '../../../types'
import type { PaneHandlers, Ui } from '../kit'
import { formView } from './form-view'
import { listView } from './list-view'

export type PaneModel = {
  /** The form being filled in, or null for the list. */
  draft: Draft | null
  custom: Array<CustomAction>
  order: Array<string>
  pendingDelete: string | null
  /** The pane's width in columns. */
  columns: number
  surface: string
}

/** The pane's current view: the form while one is filled in, the list otherwise. */
export function paneView(ui: Ui, model: PaneModel, handlers: PaneHandlers): RenderElement {
  if (model.draft !== null) {
    return formView(ui, { draft: model.draft, custom: model.custom, columns: model.columns, surface: model.surface }, handlers)
  }
  return listView(ui, model, handlers)
}
