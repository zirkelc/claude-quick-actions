import type { RenderElement } from 'claude-code'

import type { CustomAction } from '../../../types'
import { isNewline, rowsOf, sectionOf } from '../../actions'
import type { PaneHandlers, Ui } from '../kit'
import { shownLabel } from '../label'
import { keepSpaces } from '../theme'
import { headerView, sectionBar } from './header-view'
import { SECTION_MARKS } from './options'

export type ListModel = {
  /** Every saved action, in the order they were saved. */
  custom: Array<CustomAction>
  /** The band: the actions on it and its new lines, in order. */
  order: Array<string>
  /** The action whose delete button was pressed once and waits for the second press. */
  pendingDelete: string | null
  /** The pane's width in columns. */
  columns: number
  surface: string
}

/** The widest the label column gets; a longer label is cut. */
const LABEL_WIDTH = 20

/** From this width the band stands beside the list of actions; a narrower pane puts it under them. */
const WIDE_COLUMNS = 90

/** The band's column in a wide pane: a band row needs its symbol, the widest label and three controls. */
const BAND_COLUMNS = 36

/** The cells between the two columns. */
const COLUMN_GAP = 2

/** What the symbols of the list mean, under the lists. */
const LEGEND = '/ skill · > prompt · $ shell · [1] hotkey · ★ on the band · ▶ run · ✕ delete'

/** A count with its noun, in the plural unless it is one. */
const counted = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

/** What an action does, on one line: the command with its slash, the shell command, or the prompt. */
function whatOf(action: CustomAction): string {
  const text = action.text.replace(/\s+/g, ' ').trim()
  return action.kind === 'command' ? `/${text}` : text
}

/**
 * Two lists, one action or new line per line: every action, each with a star
 * that puts it on the band or takes it off, a button that runs it and a delete
 * button; then the band in its order, with buttons that move an entry or take
 * it off the band. A wide pane draws the two lists side by side.
 */
export function listView(ui: Ui, model: ListModel, handlers: PaneHandlers): RenderElement {
  const { Box, Button, Text } = ui
  const { order, pendingDelete, surface } = model
  const keep = keepSpaces(surface)
  const onBand = new Set(order)
  const width = Math.min(Math.max(1, ...model.custom.map(action => [...shownLabel(action.label)].length)), LABEL_WIDTH)

  /** The cells inside the pane's side padding, and the width of each list. */
  const inner = Math.max(1, model.columns - 2)
  const isWide = model.columns >= WIDE_COLUMNS
  const bandWidth = isWide ? BAND_COLUMNS : inner
  const actionsWidth = isWide ? inner - BAND_COLUMNS - COLUMN_GAP : inner

  /**
   * The section's symbol, dim, then the label in a column of one width; in
   * its color the label is a block, as on the band.
   */
  const labelOf = (action: CustomAction, button: RenderElement) => [
    <Box key={`mark-${action.id}`} flexShrink={0}>
      <Text dimColor>{SECTION_MARKS[sectionOf(action.kind)]}</Text>
    </Box>,
    <Box
      key={`block-${action.id}`}
      flexDirection="row"
      flexShrink={0}
      paddingX={1}
      {...(action.color ? { backgroundColor: action.color } : {})}
    >
      {button}
    </Box>,
  ]

  const columnLabel = (action: CustomAction) => keep(shownLabel(action.label, width).padEnd(width))

  /**
   * A control at the end of a row. The spaces are part of the label, so the
   * hover and the click cover them too and the target is three cells wide.
   */
  const control = (key: string, label: string, isDim: boolean, onPress: () => void) => (
    <Button key={key} label={keep(` ${label} `)} plain dimColor={isDim} onPress={onPress} />
  )

  /** One action: its label opens the form, then its hotkey and what it does, dim and cut at the pane's edge. */
  const actionRow = (action: CustomAction) => {
    const isOnBand = onBand.has(action.id)
    const edit = <Button key={`edit-${action.id}`} label={columnLabel(action)} plain onPress={() => handlers.startEdit(action)} />
    return (
      <Box key={`row-${action.id}`} flexDirection="row" columnGap={1}>
        {labelOf(action, edit)}
        <Box width={3} flexShrink={0}>
          <Text dimColor>{action.hotkey !== '' ? `[${action.hotkey}]` : ''}</Text>
        </Box>
        {/** Width 0 and grow: only this cell takes the room left, so a long text cannot squeeze the cells beside it. */}
        <Box width={0} flexGrow={1} overflow="hidden">
          <Text dimColor wrap="truncate-end">
            {whatOf(action)}
          </Text>
        </Box>
        <Box flexDirection="row" flexShrink={0}>
          {control(`pin-${action.id}`, isOnBand ? '★' : '☆', !isOnBand, () => handlers.togglePin(action.id))}
          {control(`run-${action.id}`, '▶', true, () => handlers.run(action))}
          {control(
            `delete-${action.id}`,
            pendingDelete === action.id ? 'delete? ✕' : '✕',
            pendingDelete !== action.id,
            () => handlers.pressDelete(action),
          )}
        </Box>
      </Box>
    )
  }

  /** Moves an entry of the band one place; across a new line it moves to the next or previous row. */
  const bandControls = (entry: string, index: number) => (
    <Box flexDirection="row" flexShrink={0}>
      {control(`up-${entry}`, '↑', index > 0, () => handlers.moveEntry(entry, -1))}
      {control(`down-${entry}`, '↓', index < order.length - 1, () => handlers.moveEntry(entry, 1))}
      {control(`remove-${entry}`, '-', true, () => handlers.removeFromBand(entry))}
    </Box>
  )

  /** A dim line at the end of a list that adds to it: a sign in the symbol column, the text in the label column. */
  const addRow = (key: string, label: string, onPress: () => void) => (
    <Box key={`row-${key}`} flexDirection="row" columnGap={1}>
      <Text dimColor>+</Text>
      <Box flexDirection="row" flexShrink={0} paddingX={1}>
        <Button key={key} label={label} plain dimColor onPress={onPress} />
      </Box>
    </Box>
  )

  const byId = new Map(model.custom.map(action => [action.id, action]))
  const bandActions = order.filter(entry => byId.has(entry)).length
  const bandRowCount = rowsOf(order).filter(row => row.some(entry => byId.has(entry))).length
  /** A new line splits rows of actions, so it is offered only once an action is on the band. */
  const hasActionOnBand = bandActions > 0
  const bandRows = order.flatMap((entry, index) => {
    if (isNewline(entry)) {
      return [
        <Box key={`band-row-${entry}`} flexDirection="row" justifyContent="space-between" columnGap={1}>
          <Box flexDirection="row" columnGap={1}>
            <Text dimColor>↵</Text>
            <Box flexDirection="row" paddingX={1}>
              <Text dimColor>new line</Text>
            </Box>
          </Box>
          {bandControls(entry, index)}
        </Box>,
      ]
    }
    const action = byId.get(entry)
    if (action === undefined) {
      return []
    }
    return [
      <Box key={`band-row-${entry}`} flexDirection="row" justifyContent="space-between" columnGap={1}>
        <Box flexDirection="row" columnGap={1} flexShrink={1}>
          {labelOf(action, <Text key={`band-label-${entry}`}>{columnLabel(action)}</Text>)}
        </Box>
        {bandControls(entry, index)}
      </Box>,
    ]
  })

  const summary = [
    counted(model.custom.length, 'action'),
    `${bandActions} on the band`,
    ...(bandRowCount > 1 ? [`${bandRowCount} rows`] : []),
  ].join(' · ')

  const actionsColumn = (
    <Box key="column-actions" flexDirection="column" width={actionsWidth} flexShrink={0}>
      {sectionBar(ui, surface, 'bar-actions', 'Actions', `${model.custom.length}`, actionsWidth)}
      {model.custom.map(actionRow)}
      {addRow('new', 'Add action', handlers.startAdd)}
    </Box>
  )

  const bandColumn = (
    <Box key="column-band" flexDirection="column" width={bandWidth} flexShrink={0}>
      {sectionBar(ui, surface, 'bar-band', 'Band', `${bandActions}`, bandWidth)}
      {bandRows}
      {!hasActionOnBand && <Text dimColor>Nothing on the band yet: press ☆ on an action.</Text>}
      {hasActionOnBand && addRow('newline', 'Add new line', handlers.addNewline)}
    </Box>
  )

  return (
    <Box flexDirection="column" paddingX={1}>
      {headerView(ui, surface, handlers, null, summary)}
      <Box key="columns" flexDirection={isWide ? 'row' : 'column'} {...(isWide ? { columnGap: COLUMN_GAP } : { rowGap: 1 })}>
        {actionsColumn}
        {bandColumn}
      </Box>
      <Box key="footer" marginTop={1}>
        <Text dimColor wrap="wrap">
          {LEGEND}
        </Text>
      </Box>
    </Box>
  )
}
