import type { RenderElement } from 'claude-code'

import type { PaneHandlers, Ui } from '../kit'
import { navButton } from './buttons'

/** The pane's first line: its name, and the back and close buttons right. Back is left out on the list, which has nothing to go back to. */
export function headerView(ui: Ui, surface: string, handlers: PaneHandlers, back: (() => void) | null): RenderElement {
  const { Box, Text } = ui
  return (
    <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
      <Text bold color="cyan">
        QUICK ACTIONS
      </Text>
      <Box flexDirection="row" columnGap={2}>
        {back !== null && navButton(ui, surface, 'back', '← Back', back)}
        {navButton(ui, surface, 'close', '✕ Close', handlers.close)}
      </Box>
    </Box>
  )
}
