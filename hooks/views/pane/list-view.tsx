import type { RenderElement } from 'claude-code'

import type { CustomAction } from '../../../types'
import { isNewline, sectionOf } from '../../actions'
import type { PaneHandlers, Ui } from '../kit'
import { shownLabel } from '../label'
import { ruleView } from './buttons'
import { headerView } from './header-view'
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

/** What an action does, on one line: the command with its slash, the shell command, or the prompt. */
function whatOf(action: CustomAction): string {
  const text = action.text.replace(/\s+/g, ' ').trim()
  return action.kind === 'command' ? `/${text}` : text
}

/**
 * Two lists, one action or new line per line: every action, each with a star
 * that puts it on the band or takes it off, a button that runs it and a delete
 * button; then the band in its order, with buttons that move an entry or take
 * it off the band.
 */
export function listView(ui: Ui, model: ListModel, handlers: PaneHandlers): RenderElement {
  const { Box, Button, Text } = ui
  const { order, pendingDelete } = model
  const onBand = new Set(order)
  const width = Math.min(Math.max(1, ...model.custom.map(action => [...shownLabel(action.label)].length)), LABEL_WIDTH)

  /**
   * The section's symbol in its color, then the label in a column of one
   * width; in its color the label is a block, as on the band.
   */
  const labelOf = (action: CustomAction, button: RenderElement) => {
    const mark = SECTION_MARKS[sectionOf(action.kind)]
    return [
      <Text key={`mark-${action.id}`} bold color={mark.color}>
        {mark.symbol}
      </Text>,
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
  }

  const columnLabel = (action: CustomAction) => shownLabel(action.label, width).padEnd(width)

  /** One action: its label opens the form, then its hotkey and what it does, dim and cut at the pane's edge. */
  const actionRow = (action: CustomAction) => {
    const isOnBand = onBand.has(action.id)
    const edit = <Button key={`edit-${action.id}`} label={columnLabel(action)} plain onPress={() => handlers.startEdit(action)} />
    return (
      <Box key={`row-${action.id}`} flexDirection="row" columnGap={1}>
        {labelOf(action, edit)}
        <Text dimColor>{action.hotkey !== '' ? `[${action.hotkey}]` : '   '}</Text>
        <Box flexGrow={1} flexShrink={1} overflow="hidden">
          <Text dimColor wrap="truncate-end">
            {`${action.kind === 'fill' ? 'fill: ' : ''}${whatOf(action)}`}
          </Text>
        </Box>
        <Box flexDirection="row" columnGap={1} flexShrink={0}>
          <Button
            key={`pin-${action.id}`}
            label={isOnBand ? '★' : '☆'}
            plain
            dimColor={!isOnBand}
            onPress={() => handlers.togglePin(action.id)}
          />
          <Button key={`run-${action.id}`} label="▶" plain dimColor onPress={() => handlers.run(action)} />
          <Button
            key={`delete-${action.id}`}
            label={pendingDelete === action.id ? 'delete? ✕' : '✕'}
            plain
            dimColor={pendingDelete !== action.id}
            onPress={() => handlers.pressDelete(action)}
          />
        </Box>
      </Box>
    )
  }

  /** Moves an entry of the band one place; across a new line it moves to the next or previous row. */
  const bandControls = (entry: string, index: number) => (
    <Box flexDirection="row" columnGap={1} flexShrink={0}>
      <Button key={`up-${entry}`} label="↑" plain dimColor={index > 0} onPress={() => handlers.moveEntry(entry, -1)} />
      <Button key={`down-${entry}`} label="↓" plain dimColor={index < order.length - 1} onPress={() => handlers.moveEntry(entry, 1)} />
      <Button key={`remove-${entry}`} label="-" plain dimColor onPress={() => handlers.removeFromBand(entry)} />
    </Box>
  )

  /** A dim line at the end of a list that adds to it: a sign in the symbol column, the text in the label column. */
  const addRow = (key: string, sign: string, label: string, onPress: () => void) => (
    <Box key={`row-${key}`} flexDirection="row" columnGap={1}>
      <Text dimColor>{sign}</Text>
      <Box flexDirection="row" flexShrink={0} paddingX={1}>
        <Button key={key} label={label} plain dimColor onPress={onPress} />
      </Box>
    </Box>
  )

  const byId = new Map(model.custom.map(action => [action.id, action]))
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

  return (
    <Box flexDirection="column" paddingX={1}>
      {headerView(ui, model.surface, handlers, null)}
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold>Actions</Text>
        <Text dimColor>★ on the band · ▶ run now</Text>
      </Box>
      {model.custom.map(actionRow)}
      {addRow('new', '+', 'Add action', handlers.startAdd)}
      <Box marginY={1}>{ruleView(ui, 'rule-band', model.columns - 2)}</Box>
      <Text bold>Band</Text>
      {bandRows}
      {bandRows.length === 0 && <Text dimColor>Nothing on the band yet: press ☆ on an action.</Text>}
      {addRow('newline', '+', 'Add new line', handlers.addNewline)}
    </Box>
  )
}
