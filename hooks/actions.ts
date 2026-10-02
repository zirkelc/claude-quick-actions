import type { CustomAction, CustomKind, Draft } from '../types'

type BaseAction = {
  key: string
  label: string
  /** One digit that presses the button from an empty prompt box, or while the band has the focus. */
  hotkey?: string
  /** Optional symbol drawn before the label. */
  icon?: string
  /** Color name of the icon. */
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
    /** Actions saved before icons and colors existed have neither field. */
    icon: custom.icon || undefined,
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

/**
 * Makes a new draft from what the prompt box holds: `/name args` is a command,
 * `! cmd` a shell command, anything else a prompt to submit.
 */
export function draftFromPrompt(input: string, returnTo: Draft['returnTo']): Draft {
  const typed = input.trim()
  let kind: CustomKind = 'submit'
  let text = typed
  /** A command keeps its slash in the form, as typed; saving removes it. */
  if (typed.startsWith('/')) {
    kind = 'command'
  } else if (typed.startsWith('!')) {
    kind = 'shell'
    text = typed.slice(1).trim()
  }
  const label = text.length > 20 ? `${text.slice(0, 19)}…` : text
  return { id: null, source: typed === '' ? null : typed, returnTo, error: null, picking: null, label, hotkey: '', icon: '', color: '', kind, text }
}

/** The text as the prompt box would show it, with the kind's prefix. */
export function promptText(draft: Pick<Draft, 'kind' | 'text'>): string {
  if (draft.kind === 'command') {
    return `/${draft.text}`
  }
  if (draft.kind === 'shell') {
    return `! ${draft.text}`
  }
  return draft.text
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

/**
 * Moves the action with `id` one place up (-1) or down (+1) among its peers,
 * swapping it with the nearest peer in that direction; unchanged at either end.
 * Without `isPeer` every action is a peer.
 */
export function move(
  list: Array<CustomAction>,
  id: string,
  step: -1 | 1,
  isPeer: (action: CustomAction) => boolean = () => true,
): Array<CustomAction> {
  const from = list.findIndex(action => action.id === id)
  if (from === -1) {
    return list
  }
  let to = from + step
  while (to >= 0 && to < list.length && !isPeer(list[to] as CustomAction)) {
    to += step
  }
  if (to < 0 || to >= list.length) {
    return list
  }
  const next = [...list]
  next[from] = list[to] as CustomAction
  next[to] = list[from] as CustomAction
  return next
}

export type Section = 'commands' | 'prompts' | 'shell'

/** The manage pane's section of a kind: commands run directly, prompts go to Claude, shell runs on the host. */
export function sectionOf(kind: CustomKind): Section {
  if (kind === 'command') {
    return 'commands'
  }
  return kind === 'shell' ? 'shell' : 'prompts'
}

/** The icons and colors the form offers. */
export const ICONS = ['$', '›', '/', '★', '⚡', '✓', '✎', '⟳', '↑', '↓', '⚑', '◆', '●', '♥', '⚙']
export const COLORS = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']
