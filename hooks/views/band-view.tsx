import type { RenderElement, RenderSurface } from 'claude-code'

import type { Action } from '../actions'
import type { BandHandlers, Ui } from './kit'
import { shownLabel } from './label'

export type BandModel = {
  /** The band's rows of actions, top to bottom. */
  rows: Array<Array<Action>>
  surface: RenderSurface
}

/** The band above the prompt: the actions on it, in their rows. */
export function bandView(ui: Ui, model: BandModel, handlers: BandHandlers): RenderElement {
  const { Box, Button } = ui

  /**
   * One action. On the terminal a block in the action's color, or its plain
   * label, underlined under the pointer, without one; both take one cell of
   * room on each side, so colored and plain actions line up. Other surfaces
   * draw their own button.
   */
  const item = (action: Action) => {
    const label = shownLabel(action.label)
    if (model.surface !== 'terminal') {
      return <Button key={action.key} label={label} hotkey={action.hotkey} onPress={() => handlers.run(action)} />
    }
    return (
      <Box
        key={`block-${action.key}`}
        flexDirection="row"
        flexShrink={0}
        paddingX={1}
        {...(action.color !== undefined ? { backgroundColor: action.color } : {})}
      >
        <Button
          key={action.key}
          plain
          label={label}
          hotkey={action.hotkey}
          {...(action.color === undefined ? { hover: { underline: true } } : {})}
          onPress={() => handlers.run(action)}
        />
      </Box>
    )
  }

  /** One row of the band. No wrapping: a wrapping row that may shrink reserves a second, empty line; room past the band's width is cut instead. */
  const row = (key: string, actions: Array<Action>) => (
    <Box key={key} flexDirection="row" columnGap={2} flexShrink={1} overflow="hidden">
      {actions.map(item)}
    </Box>
  )

  return (
    <Box key="quick-actions" flexDirection="column" paddingLeft={1} paddingRight={3} marginTop={1}>
      {/* The right padding keeps the last button off the band's own collapse control. */}
      {model.rows.map((actions, index) => row(`row-${index}`, actions))}
    </Box>
  )
}
