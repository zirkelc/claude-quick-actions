import type { CustomAction, CustomKind, Draft } from '../types'

type BaseAction = {
  key: string
  label: string
  /** One digit that presses the button from an empty prompt box, or while the band has the focus. */
  hotkey?: string
  /** Color name of the button. */
  color?: string
}

/**
 * One button of the band.
 *
 * - `command` runs a slash command or skill at once, as if typed (`/commit`).
 * - `submit` sends a prompt to Claude at once.
 * - `fill` puts text in the prompt box to check before sending. The box stays
 *   in prompt mode, so a leading `!` does not make it a shell command.
 * - `shell` runs a command on the host in the session's directory, without
 *   Claude, and shows its output in the transcript (Claude does not read it).
 *
 * Commands and prompts queue until the session is idle; shell commands run at once.
 */
export type Action =
  | (BaseAction & { kind: 'command'; command: string; args: string })
  | (BaseAction & { kind: 'submit' | 'fill'; text: string })
  | (BaseAction & { kind: 'shell'; argv: Array<string> })

/** Turns a saved action into a button. */
export function toAction(custom: CustomAction): Action {
  const base = {
    key: `custom-${custom.id}`,
    label: custom.label,
    /** Only digits work from the prompt box; a letter saved by an older version is dropped. */
    hotkey: /^[0-9]$/.test(custom.hotkey) ? custom.hotkey : undefined,
    /** Actions saved before colors existed have no color. */
    color: custom.color || undefined,
  }
  if (custom.kind === 'command') {
    const [command = '', ...args] = custom.text.split(' ')
    return { ...base, kind: 'command', command, args: args.join(' ') }
  }
  if (custom.kind === 'shell') {
    return { ...base, kind: 'shell', argv: ['sh', '-c', custom.text] }
  }
  return { ...base, kind: custom.kind, text: custom.text }
}

/** An empty form for a new action: a prompt that is sent at once. */
export function newDraft(): Draft {
  return { id: null, error: null, picking: null, label: '', hotkey: '', color: '', kind: 'submit', text: '' }
}

/**
 * The text as it is saved: trimmed, and without the prefix a person may type
 * out of habit, `/` before a command and `!` before a shell command.
 */
export function normalizeText(kind: CustomKind, text: string): string {
  const trimmed = text.trim()
  if (kind === 'command') {
    return trimmed.replace(/^\/+/, '')
  }
  if (kind === 'shell') {
    return trimmed.replace(/^!\s*/, '')
  }
  return trimmed
}

/**
 * Checks a draft before it is saved, and returns the reason it cannot be, or
 * null. `usedHotkeys` are those of every other shown action.
 */
export function checkDraft(draft: Draft, usedHotkeys: Array<string>): string | null {
  const text = normalizeText(draft.kind, draft.text)
  if (draft.label.trim() === '') {
    return 'The label is empty.'
  }
  if (text === '') {
    return 'The action text is empty.'
  }
  if (draft.kind === 'command' && !/^[\w:.-]+/.test(text)) {
    return 'A command starts with its name, e.g. "commit" or "pr --draft".'
  }
  if (draft.hotkey !== '' && !/^[0-9]$/.test(draft.hotkey)) {
    return 'The hotkey must be one digit.'
  }
  if (draft.hotkey !== '' && usedHotkeys.includes(draft.hotkey)) {
    return `The hotkey "${draft.hotkey}" is already in use.`
  }
  return null
}

/** Entries of the list that start a new row on the band carry this prefix before their own id. */
export const NEWLINE_PREFIX = 'newline:'

export function isNewline(entry: string): boolean {
  return entry.startsWith(NEWLINE_PREFIX)
}

/** A new entry that starts a new row on the band. */
export function newlineEntry(): string {
  return `${NEWLINE_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Makes the stored band order fit the saved actions: ids of deleted actions
 * go, and an entry that shows twice keeps its first place. Actions in no
 * place are not on the band, so with no order stored yet the band is empty.
 */
export function arrangeOrder(stored: unknown, ids: Array<string>): Array<string> {
  if (!Array.isArray(stored)) {
    return []
  }
  const known = new Set(ids)
  const seen = new Set<string>()
  return stored.filter((entry): entry is string => {
    if (typeof entry !== 'string' || seen.has(entry) || (!known.has(entry) && !isNewline(entry))) {
      return false
    }
    seen.add(entry)
    return true
  })
}

/** Puts an action on the band, at the end, or takes it off. */
export function togglePin(order: Array<string>, id: string): Array<string> {
  return order.includes(id) ? order.filter(entry => entry !== id) : [...order, id]
}

/** Moves an entry one place up (-1) or down (+1); unchanged at either end. */
export function moveEntry(order: Array<string>, entry: string, step: -1 | 1): Array<string> {
  const from = order.indexOf(entry)
  const to = from + step
  if (from === -1 || to < 0 || to >= order.length) {
    return order
  }
  const next = [...order]
  next[from] = order[to] as string
  next[to] = entry
  return next
}

/** The rows of the band: the order split at each new line entry, empty rows left out. */
export function rowsOf(order: Array<string>): Array<Array<string>> {
  const rows: Array<Array<string>> = [[]]
  for (const entry of order) {
    if (isNewline(entry)) {
      rows.push([])
    } else {
      rows[rows.length - 1]?.push(entry)
    }
  }
  return rows.filter(row => row.length > 0)
}

export type Section = 'commands' | 'prompts' | 'shell'

/** The manage pane's section of a kind: commands run directly, prompts go to Claude, shell runs on the host. */
export function sectionOf(kind: CustomKind): Section {
  if (kind === 'command') {
    return 'commands'
  }
  return kind === 'shell' ? 'shell' : 'prompts'
}

/** The colors the form offers. */
export const COLORS = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']

/** The RGB values of the named colors, as common terminal themes draw them. */
const NAMED_RGB: Record<string, [number, number, number]> = {
  black: [0, 0, 0],
  red: [205, 49, 49],
  green: [13, 188, 121],
  yellow: [229, 229, 16],
  blue: [36, 114, 200],
  magenta: [188, 63, 188],
  cyan: [17, 168, 205],
  white: [229, 229, 229],
  gray: [102, 102, 102],
  grey: [102, 102, 102],
}

/** Reads a named color, `#rrggbb` or `rgb(r,g,b)`; null for anything else. */
function rgbOf(color: string): [number, number, number] | null {
  const name = color.toLowerCase().replace(/bright$/, '')
  if (name in NAMED_RGB) {
    return NAMED_RGB[name] ?? null
  }
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color)
  if (hex !== null) {
    return [parseInt(hex[1] ?? '', 16), parseInt(hex[2] ?? '', 16), parseInt(hex[3] ?? '', 16)]
  }
  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(color)
  if (rgb !== null) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  }
  return null
}

/** The relative luminance of WCAG 2: 0 for black, 1 for white. */
function luminanceOf([red, green, blue]: [number, number, number]): number {
  const linear = (channel: number) => {
    const value = channel / 255
    return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
}

/**
 * Black or white, whichever has the higher WCAG contrast ratio on the given
 * background color; white for a color it cannot read.
 */
export function textColorOn(background: string): 'black' | 'white' {
  const rgb = rgbOf(background)
  if (rgb === null) {
    return 'white'
  }
  const luminance = luminanceOf(rgb)
  const onBlack = (luminance + 0.05) / 0.05
  const onWhite = 1.05 / (luminance + 0.05)
  return onBlack > onWhite ? 'black' : 'white'
}
