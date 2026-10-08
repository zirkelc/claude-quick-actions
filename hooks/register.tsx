import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { CustomAction, Draft } from '../types'
import {
  type Action,
  arrangeOrder,
  checkDraft,
  moveEntry,
  newlineEntry,
  newDraft,
  normalizeText,
  rowsOf,
  toAction,
  togglePin,
} from './actions'
import { POLL_MS, SHELL_TIMEOUT_MS } from './limits'
import { COMMAND, LEGACY_PANES, PANE, PANE_IN_BAND_TEXT, PANE_OPTIONS, STEP_BACK_REASON, STORE_ACTIONS, STORE_ORDER } from './names'
import { bandView } from './views/band-view'
import type { BandHandlers, PaneHandlers } from './views/kit'
import { type PaneModel, paneView } from './views/pane/pane-view'

const customState = atom({ plugin: 'quick-actions', key: 'custom' } as const, [])
const orderState = atom({ plugin: 'quick-actions', key: 'order' } as const, [])
const draftState = atom({ plugin: 'quick-actions', key: 'draft' } as const, null)
const pendingDeleteState = atom({ plugin: 'quick-actions', key: 'pendingDelete' } as const, null)
const paneOpenState = atom({ plugin: 'quick-actions', key: 'isPaneOpen' } as const, false)
const paneInBandState = atom({ plugin: 'quick-actions', key: 'isPaneInBand' } as const, false)

/** Reads the saved actions and their order from the store, so changes from other sessions show up. */
export async function loadStore($: EngineInterface) {
  const stored = await $.store.get(STORE_ACTIONS)
  const custom = Array.isArray(stored) ? (stored as Array<CustomAction>) : []
  await update($, customState, () => custom)
  const order = arrangeOrder(await $.store.get(STORE_ORDER), custom.map(action => action.id))
  await update($, orderState, () => order)
}

/** Saves the actions; a deleted one leaves the band too. */
async function writeCustom($: EngineInterface, custom: Array<CustomAction>) {
  await $.store.set(STORE_ACTIONS, custom)
  await update($, customState, () => custom)
  await writeOrder($, arrangeOrder(await read($, orderState), custom.map(action => action.id)))
}

/** Saves the band: its actions and new lines, in order. */
async function writeOrder($: EngineInterface, order: Array<string>) {
  await $.store.set(STORE_ORDER, order)
  await update($, orderState, () => order)
}

/**
 * Opens the pane. Called before any other await of a press, so the engine
 * counts the open as the person's. A pane without room to draw would wait
 * undrawn, so it is closed again and the band shows its views instead.
 */
async function openPane($: EngineInterface): Promise<boolean> {
  const opened = await $.ui.open(PANE_OPTIONS)
  if (!opened.isPlaced) {
    await $.ui.close({ id: PANE }).catch(() => undefined)
  }
  await update($, paneOpenState, () => opened.isPlaced)
  await update($, paneInBandState, () => !opened.isPlaced)
  return opened.isPlaced
}

/**
 * Closes the pane, or its views in the band. A close the mod makes itself
 * does not always reach its own close hook, so the flags are cleared here.
 */
async function closePane($: EngineInterface) {
  await $.ui.close({ id: PANE })
  await update($, paneOpenState, () => false)
  await update($, paneInBandState, () => false)
}

/** Runs a press's work, and says in the transcript when it fails; a press has no caller to report to. */
function report($: EngineInterface, what: string, work: Promise<unknown>) {
  work.catch(error => $.ui.log(`Quick actions: ${what} failed: ${error instanceof Error ? error.message : String(error)}`))
}

/** Opens the pane on the list of actions. */
async function openList($: EngineInterface) {
  const opened = openPane($)
  await update($, draftState, () => null)
  return opened
}

/** Opens the list, or closes the pane when it is open in any view, in the pane or in the band. */
async function toggleList($: EngineInterface) {
  const isOpen = (await read($, paneOpenState)) || (await read($, paneInBandState))
  return isOpen ? closePane($).then(() => true) : openList($)
}

/** Opens the form for a new action in place of the list. */
async function startAdd($: EngineInterface) {
  await update($, draftState, () => newDraft())
}

async function startEdit($: EngineInterface, action: CustomAction) {
  /** Actions saved before colors existed have no color. A command shows with its slash, as typed. */
  await update($, draftState, () => ({
    ...action,
    text: action.kind === 'command' ? `/${action.text}` : action.text,
    color: action.color ?? '',
    error: null,
    picking: null,
  }))
}

/** Leaves the form, back to the list. */
async function leaveForm($: EngineInterface) {
  await update($, draftState, () => null)
}

/** Applies a change to the form; any change clears the last save error. */
async function editDraft($: EngineInterface, change: Partial<Draft>) {
  await update($, draftState, draft => (draft === null ? null : { ...draft, error: null, ...change }))
}

async function saveDraft($: EngineInterface) {
  const draft = await read($, draftState)
  if (draft === null) {
    return
  }
  const custom = await read($, customState)
  const usedHotkeys = custom.filter(action => action.id !== draft.id && action.hotkey !== '').map(action => action.hotkey)

  /** Shown in the form: the pane holds toasts back while it is open, so a toast would stay unseen. */
  const problem = checkDraft(draft, usedHotkeys)
  if (problem !== null) {
    await update($, draftState, current => (current === null ? null : { ...current, error: problem }))
    return
  }

  const saved: CustomAction = {
    id: draft.id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    label: draft.label.trim(),
    hotkey: draft.hotkey,
    color: draft.color,
    kind: draft.kind,
    text: normalizeText(draft.kind, draft.text),
  }
  await writeCustom($, draft.id === null ? [...custom, saved] : custom.map(action => (action.id === draft.id ? saved : action)))
  await leaveForm($)
  $.ui.toast(`Saved "${saved.label}"`)
}

/** Deletes on the second press, so one stray click cannot remove an action. */
async function pressDelete($: EngineInterface, action: CustomAction) {
  if ((await read($, pendingDeleteState)) !== action.id) {
    await update($, pendingDeleteState, () => action.id)
    return
  }
  await update($, pendingDeleteState, () => null)
  await writeCustom($, (await read($, customState)).filter(one => one.id !== action.id))
  $.ui.toast(`Deleted "${action.label}"`)
}

async function runShell($: EngineInterface, argv: Array<string>) {
  const line = argv[0] === 'sh' && argv[1] === '-c' ? (argv[2] ?? '') : argv.join(' ')
  $.ui.toast(`${line} …`)
  try {
    const { exitCode, stdout, stderr } = await $.process.run(argv, { timeoutMs: SHELL_TIMEOUT_MS })
    const output = `${stdout}${stderr}`.trim()
    $.ui.log(`$ ${line}${output === '' ? '' : `\n${output}`}${exitCode === 0 ? '' : `\nexit ${exitCode}`}`)
    $.ui.toast(exitCode === 0 ? `${line}: done` : `${line}: failed (exit ${exitCode})`)
  } catch (error) {
    $.ui.log(`$ ${line}\n${error instanceof Error ? error.message : String(error)}`)
    $.ui.toast(`${line}: did not run`)
  }
}

async function run($: EngineInterface, action: Action) {
  if (action.kind === 'command') {
    await $.command.run({ command: action.command, args: action.args })
  } else if (action.kind === 'submit') {
    await $.prompt.submit({ text: action.text, asUser: true })
  } else if (action.kind === 'shell') {
    await runShell($, action.argv)
  } else {
    await $.prompt.fill({ text: action.text })
  }
}

/** The pane's handlers, bound to one engine interface. */
function paneHandlersOf($: EngineInterface, order: Array<string>): PaneHandlers {
  return {
    close: () => report($, 'closing the pane', closePane($)),
    startAdd: () => report($, 'opening the form', startAdd($)),
    startEdit: action => report($, 'opening the form', startEdit($, action)),
    pressDelete: action => report($, 'deleting the action', pressDelete($, action)),
    moveEntry: (entry, step) => report($, 'moving the entry', writeOrder($, moveEntry(order, entry, step))),
    removeFromBand: entry => report($, 'removing from the band', writeOrder($, order.filter(one => one !== entry))),
    togglePin: id => report($, 'changing the band', writeOrder($, togglePin(order, id))),
    run: action => report($, `running "${action.label}"`, run($, toAction(action))),
    addNewline: () => report($, 'adding a new line', writeOrder($, [...order, newlineEntry()])),
    editDraft: change => editDraft($, change),
    saveDraft: () => report($, 'saving the action', saveDraft($)),
    leaveForm: () => report($, 'leaving the form', leaveForm($)),
  }
}

async function paneModelOf($: EngineInterface, columns: number, surface: string): Promise<PaneModel> {
  return {
    draft: await read($, draftState),
    custom: await read($, customState),
    order: await read($, orderState),
    pendingDelete: await read($, pendingDeleteState),
    columns,
    surface,
  }
}

/** The poll that reads the saved actions again; a new session start replaces it. */
let poll: Timer | undefined

/** Reads the saved actions again, for changes from other sessions. Started from a timer without a caller, so a failure goes to the debug log. */
async function reload($: EngineInterface) {
  try {
    await loadStore($)
  } catch (error) {
    $.ui.log(`reading the saved actions failed: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    /**
     * Earlier versions opened separate panes under these ids; nothing draws them
     * any more, so they would stay empty. A failed close must not stop the start.
     */
    await Promise.all(LEGACY_PANES.map(id => $.ui.close({ id }).catch(() => undefined)))
    /** A hot reload can find the pane still open. A failed read must not stop the start either. */
    const panes = await $.ui.panes().catch(() => [])
    await update($, paneOpenState, () => panes.some(pane => pane.id === PANE && pane.isPlaced))
    await update($, paneInBandState, () => false)
    try {
      await $.command.register(COMMAND)
    } catch (error) {
      $.ui.log(`Quick actions: /${COMMAND.name} is not available: ${error instanceof Error ? error.message : String(error)}`)
    }
    await reload($)
    /** A new start (a clear, a resume) replaces the poll of the one before. */
    poll?.cancel()
    poll = $.clock.every(POLL_MS, () => void reload($))
    return started
  })

  on('command.run', { command: COMMAND.name }, async $ => {
    const isShown = await toggleList($)
    /** No text when the pane opened or closed, so the command leaves no line in the transcript. */
    return isShown || !(await read($, paneInBandState)) ? {} : { text: PANE_IN_BAND_TEXT }
  })

  /**
   * Esc steps back as the config menu does: from an option list to the form,
   * from a form opened in the list back to the list; only then it closes.
   */
  on('ui.close', { id: PANE }, async ($, e, next) => {
    /** Lets the close through and clears the open flag, for closes the mod did not make itself (Esc, the engine's mark). */
    const close = async () => {
      const closed = await next(e)
      await update($, paneOpenState, () => false)
      return closed
    }
    const draft = await read($, draftState)
    if (e.origin.kind !== 'person' || draft === null) {
      return close()
    }
    if (draft.picking !== null) {
      await editDraft($, { picking: null })
      return { deny: STEP_BACK_REASON }
    }
    await leaveForm($)
    return { deny: STEP_BACK_REASON }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    /** The engine raises the band on the terminal and the desktop only; the mobile app has no Input for the form. */
    if (e.props.hasSurvey || e.surface === 'mobile') {
      return next(e)
    }
    /**
     * The band of the plugins beneath, drawn under this one. The engine's own
     * drawing holds only the surveys, so without a survey it adds nothing.
     */
    const below = await next(e)
    const ui = $.ui.resolve(e)

    let band
    if (await read($, paneInBandState)) {
      band = paneView(ui, await paneModelOf($, e.props.bodyColumns, e.surface), paneHandlersOf($, await read($, orderState)))
    } else {
      const byId = new Map((await read($, customState)).map(action => [action.id, toAction(action)]))
      const rows = rowsOf(await read($, orderState))
        .map(row => row.flatMap(id => byId.get(id) ?? []))
        .filter(row => row.length > 0)
      /** With nothing on the band, the band is not drawn; the plugins beneath still draw theirs. */
      if (rows.length === 0) {
        return below
      }
      band = bandView(ui, { rows, surface: e.surface }, { run: action => report($, `running "${action.label}"`, run($, action)) })
    }

    if (below === null || below === undefined || below.type === 'engine') {
      return band
    }
    const { Box } = ui
    return (
      <Box flexDirection="column">
        {band}
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface === 'mobile') {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>Manage quick actions in the terminal or the desktop app.</Text>
    }
    return paneView($.ui.resolve(e), await paneModelOf($, e.props.bodyColumns, e.surface), paneHandlersOf($, await read($, orderState)))
  })
}
