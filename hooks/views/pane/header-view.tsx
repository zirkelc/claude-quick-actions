import type { RenderElement } from 'claude-code'

import type { PaneHandlers, Ui } from '../kit'
import { ACCENT, BAR_GROUND, BAR_TEXT, keepSpaces } from '../theme'
import { navButton } from './buttons'

/**
 * The pane's head in a rounded frame: its name with the back and close
 * buttons right, and under it a dim line that says what the view holds. Back
 * is left out on the list, which has nothing to go back to.
 */
export function headerView(ui: Ui, surface: string, handlers: PaneHandlers, back: (() => void) | null, summary: string): RenderElement {
  const { Box, Text } = ui
  return (
    <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1} marginBottom={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text>
          <Text bold color={ACCENT}>
            ◆{' '}
          </Text>
          <Text bold>Quick actions</Text>
        </Text>
        <Box flexDirection="row" columnGap={2}>
          {back !== null && navButton(ui, surface, 'back', '← Back', back)}
          {navButton(ui, surface, 'close', '✕ Close', handlers.close)}
        </Box>
      </Box>
      <Text dimColor wrap="truncate-end">
        {keepSpaces(surface)(summary)}
      </Text>
    </Box>
  )
}

/**
 * The head of one part of a view: a bar of `width` cells on a dark ground,
 * with the part's name left and its count right in the accent, so the parts
 * stand apart without a rule between them.
 */
export function sectionBar(ui: Ui, surface: string, key: string, title: string, count: string, width: number): RenderElement {
  const { Box, Text } = ui
  const keep = keepSpaces(surface)
  const left = ` ${title}`
  const right = `${count} `
  const gap = Math.max(1, width - [...left].length - [...right].length)
  return (
    <Box key={key} flexDirection="row" flexShrink={0} backgroundColor={BAR_GROUND}>
      <Text key="title" bold color={BAR_TEXT} backgroundColor={BAR_GROUND}>
        {keep(`${left}${' '.repeat(gap)}`)}
      </Text>
      <Text key="count" bold color={ACCENT} backgroundColor={BAR_GROUND}>
        {keep(right)}
      </Text>
    </Box>
  )
}
