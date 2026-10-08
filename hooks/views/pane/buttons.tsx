import type { RenderElement } from 'claude-code'

import type { Ui } from '../kit'

/** The background of an action button in the terminal: the blue of a VS Code button, readable in both themes. */
export const BUTTON_COLOR = '#0e639c'

/**
 * A button as an action: in the terminal a label on a colored ground, or the
 * same label dimmed and without ground for an option not chosen; elsewhere the
 * surface's own button, primary or not.
 */
export function actionButton(
  ui: Ui,
  surface: string,
  key: string,
  label: string,
  onPress: () => void,
  isChosen = true,
): RenderElement {
  const { Box, Button } = ui
  if (surface !== 'terminal') {
    return <Button key={key} label={label} variant={isChosen ? 'primary' : 'secondary'} onPress={onPress} />
  }
  return (
    <Box key={`box-${key}`} flexDirection="row" flexShrink={0} paddingX={1} {...(isChosen ? { backgroundColor: BUTTON_COLOR } : {})}>
      <Button key={key} label={label} plain {...(isChosen ? {} : { dimColor: true })} onPress={onPress} />
    </Box>
  )
}

/** A button that moves between views, as plain text in the terminal; elsewhere the surface's own button. */
export function navButton(ui: Ui, surface: string, key: string, label: string, onPress: () => void): RenderElement {
  const { Button } = ui
  if (surface !== 'terminal') {
    return <Button key={key} label={label} variant="secondary" onPress={onPress} />
  }
  return <Button key={key} label={label} plain onPress={onPress} />
}

/** A dim rule across the pane, to set one part of a view off from the next. */
export function ruleView(ui: Ui, key: string, columns: number): RenderElement {
  const { Text } = ui
  return (
    <Text key={key} dimColor>
      {'─'.repeat(Math.max(columns, 1))}
    </Text>
  )
}
