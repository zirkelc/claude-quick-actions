import type { RenderElement } from 'claude-code'

import type { CustomAction, Draft } from '../../../types'
import { textColorOn } from '../../actions'
import type { PaneHandlers, Ui } from '../kit'
import { shownLabel } from '../label'
import { actionButton, ruleView } from './buttons'
import { headerView } from './header-view'
import { COLOR_OPTIONS, HOTKEYS, type Option, TEXT_FIELDS, TYPES } from './options'

export type FormModel = {
  draft: Draft
  /** The saved actions, so a hotkey another action uses is not offered. */
  custom: Array<CustomAction>
  /** The pane's width in columns. */
  columns: number
  surface: string
}

type Setting = { id: 'color' | 'hotkey'; title: string; question: string; options: ReadonlyArray<Option> }

/** The width of a setting's name, so the values of all settings start in one column. */
const TITLE_WIDTH = 8

/** The cells one option takes as a button: its label, or a one-cell swatch for a color, the ground's padding, and the gap before the next. */
const optionCells = (setting: Setting, option: Option) => (setting.id === 'color' ? 1 : [...option.label].length) + 2 + 1

/**
 * The form that adds or edits an action. A setting shows its options as a row
 * of buttons when they fit the pane; otherwise as its value, which opens the
 * setting's option list in place of the form.
 */
export function formView(ui: Ui, model: FormModel, handlers: PaneHandlers): RenderElement {
  const { Box, Button, Input, Text } = ui
  const { draft, surface } = model
  const field = TEXT_FIELDS[draft.kind]

  /** Digits another action already uses are left out, so a clash cannot be picked. */
  const used = new Set(model.custom.filter(action => action.id !== draft.id).map(action => action.hotkey))
  const hotkeyOptions = [{ value: '', label: '-' }, ...HOTKEYS.filter(digit => !used.has(digit)).map(digit => ({ value: digit, label: digit }))]

  const settings: Array<Setting> = [
    { id: 'color', title: 'Color', question: 'The color of the button', options: COLOR_OPTIONS },
    { id: 'hotkey', title: 'Hotkey', question: 'The digit that presses the button from an empty prompt box', options: hotkeyOptions },
  ]

  /**
   * One option as a button: blue when chosen, dim when not. On the terminal a
   * color is a swatch in its own color without text, ticked when chosen, so
   * the colors fit a narrow pane; the default color is a dash.
   */
  const optionButton = (setting: Setting, option: Option) => {
    const key = `${setting.id}-${option.value || 'none'}`
    const isChosen = draft[setting.id] === option.value
    const pick = () => void handlers.editDraft({ [setting.id]: option.value, picking: null })
    if (setting.id === 'color' && surface === 'terminal') {
      return (
        <Box
          key={`box-${key}`}
          flexDirection="row"
          flexShrink={0}
          paddingX={1}
          {...(option.value !== '' ? { backgroundColor: option.value } : {})}
        >
          <Button key={key} label={isChosen ? '✔' : option.value === '' ? '-' : ' '} plain dimColor={option.value === '' && !isChosen} onPress={pick} />
        </Box>
      )
    }
    return actionButton(ui, surface, key, option.label, pick, isChosen)
  }

  const picking = settings.find(setting => setting.id === draft.picking)
  if (picking !== undefined) {
    return pickerView(ui, model, picking, handlers)
  }

  /** The type as one button for each kind. */
  const typeRow = (
    <Box key="setting-row-kind" flexDirection="row" columnGap={1}>
      <Text>{'Type'.padEnd(TITLE_WIDTH)}</Text>
      {TYPES.map(type =>
        actionButton(ui, surface, `kind-${type.kind}`, type.label, () => void handlers.editDraft({ kind: type.kind }), draft.kind === type.kind),
      )}
    </Box>
  )

  /** A setting as a row of option buttons when they fit, or as its value that opens the option list. */
  const settingRow = (setting: Setting) => {
    const cells = TITLE_WIDTH + 1 + setting.options.reduce((sum, option) => sum + optionCells(setting, option), 0)
    if (cells <= model.columns - 2) {
      return (
        <Box key={`setting-row-${setting.id}`} flexDirection="row" columnGap={1}>
          <Text>{setting.title.padEnd(TITLE_WIDTH)}</Text>
          {setting.options.map(option => optionButton(setting, option))}
        </Box>
      )
    }
    const option = setting.options.find(one => one.value === draft[setting.id]) ?? setting.options[0]
    return (
      <Box key={`setting-row-${setting.id}`} flexDirection="row" columnGap={1}>
        <Button
          key={`setting-${setting.id}`}
          label={`${setting.title.padEnd(TITLE_WIDTH)}${option?.label ?? ''} ›`}
          plain
          onPress={() => void handlers.editDraft({ picking: setting.id })}
        />
        {setting.id === 'color' && <Text color={draft.color || undefined}>■■■</Text>}
      </Box>
    )
  }

  /**
   * The button as the band draws it: a block in the action's color with black or white text,
   * whichever reads better on it, or the plain label without a color.
   */
  const label = shownLabel(draft.label) || '…'
  const preview =
    draft.color !== '' ? (
      <Text backgroundColor={draft.color} color={textColorOn(draft.color)}>{` ${label} `}</Text>
    ) : (
      <Text>{` ${label} `}</Text>
    )

  return (
    <Box flexDirection="column" paddingX={1}>
      {headerView(ui, surface, handlers, handlers.leaveForm)}
      <Text bold>{draft.id === null ? 'New action' : 'Edit action'}</Text>
      <Box flexDirection="column" rowGap={1} marginTop={1}>
        {typeRow}
        {settings.map(settingRow)}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>Label</Text>
        {ruleView(ui, 'rule-label-top', model.columns - 2)}
        <Box flexDirection="row">
          <Text bold>❯ </Text>
          <Input
            key="label"
            placeholder="review diff"
            value={draft.label}
            submitLabel="save"
            onInput={value => void handlers.editDraft({ label: value })}
            onSubmit={value => void handlers.editDraft({ label: value }).then(handlers.saveDraft)}
          />
        </Box>
        {ruleView(ui, 'rule-label-bottom', model.columns - 2)}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text dimColor>{field.title}</Text>
          <Text dimColor>Enter adds a line</Text>
        </Box>
        {ruleView(ui, 'rule-text-top', model.columns - 2)}
        {/* The input is one line and Enter submits it, so Enter appends a line break and Save saves. */}
        <Box flexDirection="row" minHeight={3}>
          <Text bold>❯ </Text>
          <Input
            key="text"
            placeholder={field.placeholder}
            value={draft.text}
            autoFocus
            submitLabel="new line"
            onInput={value => void handlers.editDraft({ text: value })}
            onSubmit={value => void handlers.editDraft({ text: `${value}\n` })}
          />
        </Box>
        {ruleView(ui, 'rule-text-bottom', model.columns - 2)}
      </Box>
      {draft.error !== null && <Text color="red">{draft.error}</Text>}
      <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
        {actionButton(ui, surface, 'save', 'Save', handlers.saveDraft)}
        <Box flexDirection="row" columnGap={1}>
          <Text dimColor>Preview:</Text>
          {preview}
        </Box>
      </Box>
    </Box>
  )
}

/**
 * The option list of one setting, for a pane too narrow for its row of
 * buttons: the current option ticked and focused, a press picks it and returns
 * to the form, Back or Esc returns without a change.
 */
function pickerView(ui: Ui, model: FormModel, setting: Setting, handlers: PaneHandlers): RenderElement {
  const { Box, Button, Text } = ui
  const current = model.draft[setting.id]
  /** Labels padded to the longest, so the swatches start in one column. */
  const width = Math.max(...setting.options.map(option => option.label.length))
  return (
    <Box flexDirection="column" paddingX={1}>
      {headerView(ui, model.surface, handlers, () => void handlers.editDraft({ picking: null }))}
      <Text bold>{setting.question}</Text>
      <Box flexDirection="column" marginTop={1}>
        {setting.options.map(option => (
          <Box key={`option-row-${option.value || 'none'}`} flexDirection="row" columnGap={2}>
            <Button
              key={`${setting.id}-${option.value || 'none'}`}
              label={`${option.value === current ? '✔' : ' '} ${option.label.padEnd(width)}`}
              plain
              autoFocus={option.value === current ? true : undefined}
              onPress={() => void handlers.editDraft({ [setting.id]: option.value, picking: null })}
            />
            {setting.id === 'color' && <Text color={option.value || undefined}>■■■</Text>}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
