import type { CustomKind } from '../../../types'
import { COLORS, type Section } from '../../actions'

export type Option = { value: string; label: string; hint?: string }

/** The types the form offers, one button each. */
export const TYPES: Array<{ kind: CustomKind; label: string }> = [
  { kind: 'command', label: 'Call Skill' },
  { kind: 'fill', label: 'Fill Prompt' },
  { kind: 'submit', label: 'Send Prompt' },
  { kind: 'shell', label: 'Run Shell' },
]

export const COLOR_OPTIONS: Array<Option> = [{ value: '', label: 'default' }, ...COLORS.map(color => ({ value: color, label: color }))]

/** The symbol in its color that marks an action's section in the list. */
export const SECTION_MARKS: Record<Section, { color: string; symbol: string }> = {
  commands: { color: 'blue', symbol: '/' },
  prompts: { color: 'magenta', symbol: '>' },
  shell: { color: 'cyan', symbol: '$' },
}

/** Digits in keyboard order; a digit hotkey works from an empty prompt box. */
export const HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

/** What the big field of the form holds, by kind. */
export const TEXT_FIELDS: Record<CustomKind, { title: string; placeholder: string }> = {
  command: { title: 'Skill', placeholder: '/release-pr record' },
  submit: { title: 'Prompt', placeholder: 'Review the diff for bugs' },
  fill: { title: 'Prompt', placeholder: 'Review the diff for bugs' },
  shell: { title: 'Command', placeholder: 'pnpm test' },
}
