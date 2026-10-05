import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { BandLayout, CustomAction, CustomKind, Draft, DraftSetting, GitState } from '../types'
import {
  type Action,
  COLORS,
  ICONS,
  checkDraft,
  draftFromPrompt,
  sectionOf,
  type Section,
  move,
  normalizeText,
  toAction,
} from './actions'
import { basename, parseStatus } from './git'

/** How often the git state is read again while the session sits idle. */
const REFRESH_MS = 15_000

const LEGACY_PANES = ['quick-actions-edit', 'quick-actions-manage']

/** One pane for the list of actions and the form that adds or edits one. */
const PANE = 'quick-actions'
const PANE_OPTIONS = { id: PANE, title: 'Quick actions', focus: true, closeOnEscape: true, holdToasts: true, rows: 20 } as const

/** Keys in the store, which keeps the person's actions and settings across sessions. */
const STORE_ACTIONS = 'actions'
const STORE_LAYOUT = 'layout'

const LAYOUTS: Record<BandLayout, string> = { one: 'one band', separate: 'one band per section' }

type Option = { value: string; label: string; hint?: string }

const KINDS: Array<Option & { value: CustomKind }> = [
  { value: 'command', label: 'skill / command', hint: 'runs at once, as if typed with its slash' },
  { value: 'submit', label: 'send prompt', hint: 'sent to Claude at once' },
  { value: 'fill', label: 'fill prompt box', hint: 'put in the prompt box to edit before sending' },
  { value: 'shell', label: 'shell command', hint: 'runs on this machine, without Claude' },
]

const ICON_OPTIONS: Array<Option> = [{ value: '', label: 'none' }, ...ICONS.map(icon => ({ value: icon, label: icon }))]
const COLOR_OPTIONS: Array<Option> = [{ value: '', label: 'default' }, ...COLORS.map(color => ({ value: color, label: color }))]

/** The sections, in order; the symbol in its color marks a section in the pane and on its own band. */
const SECTIONS: Array<{ id: Section; title: string; hint: string; color: string; symbol: string }> = [
  { id: 'commands', title: 'Commands', hint: 'skills and slash commands, run directly', color: 'blue', symbol: '/' },
  { id: 'prompts', title: 'Prompts', hint: 'text for Claude, sent or put in the prompt box', color: 'magenta', symbol: '>' },
  { id: 'shell', title: 'Shell', hint: 'run on this machine, without Claude', color: 'cyan', symbol: '$' },
]

/** Digits in keyboard order; a digit hotkey works from an empty prompt box. */
const HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

/** What the big field of the form holds, by kind. */
const TEXT_FIELDS: Record<CustomKind, { title: string; placeholder: string }> = {
  command: { title: 'Skill or slash command, with its arguments', placeholder: '/release-pr record' },
  submit: { title: 'Prompt, sent to Claude on press', placeholder: 'Review the diff for bugs' },
  fill: { title: 'Prompt, put in the prompt box on press', placeholder: 'Review the diff for bugs' },
  shell: { title: 'Shell command, run with sh -c', placeholder: 'pnpm test' },
}

const gitState = atom({ plugin: 'quick-actions', key: 'git' } as const, null)
const customState = atom({ plugin: 'quick-actions', key: 'custom' } as const, [])
const draftState = atom({ plugin: 'quick-actions', key: 'draft' } as const, null)
const pendingDeleteState = atom({ plugin: 'quick-actions', key: 'pendingDelete' } as const, null)
const paneOpenState = atom({ plugin: 'quick-actions', key: 'isPaneOpen' } as const, false)
const layoutState = atom({ plugin: 'quick-actions', key: 'layout' } as const, 'one')

/**
 * Reads the git state of `cwd`, or null outside a repository. Every call skips
 * optional locks, so a refresh never holds the index lock while the agent runs
 * its own git commands.
 */
async function readGit($: EngineInterface, cwd: string): Promise<GitState | null> {
  const git = async (...args: Array<string>) => {
    const { exitCode, stdout } = await $.process.run(['git', '--no-optional-locks', '-c', 'gc.auto=0', ...args], {
      cwd,
      timeoutMs: 5_000,
    })
    return exitCode === 0 ? stdout.trim() : null
  }

  const paths = await git('rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir', '--show-toplevel')
  if (paths === null) {
    return null
  }
  const [gitDir, commonDir, toplevel] = paths.split('\n')

  const status = await git('status', '--porcelain=v2', '--branch')
  if (status === null) {
    return null
  }
  const state = parseStatus(status)

  /** A linked worktree has its own git dir; this also holds for worktrees of a bare repository. */
  const worktree = gitDir !== commonDir ? basename(toplevel ?? cwd) : null

  let base = await git('symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD')
  if (base === null) {
    for (const candidate of ['origin/main', 'origin/master']) {
      if ((await git('show-ref', '--verify', '--quiet', `refs/remotes/${candidate}`)) !== null) {
        base = candidate
        break
      }
    }
  }

  /** Skipped when the base is the upstream, since the upstream count already shows it. */
  let baseBehind = 0
  if (base !== null && base !== state.upstream) {
    baseBehind = Number(await git('rev-list', '--count', `HEAD..${base}`)) || 0
  }

  return { ...state, worktree, base, baseBehind }
}

/** Reads the git state, the saved actions and the layout again; the latter so changes from other sessions show up. */
async function refresh($: EngineInterface) {
  /** Started from timers and buttons without a caller to report to, so a failure goes to the debug log. */
  try {
    const git = await readGit($, await $.session.cwd())
    await update($, gitState, () => git)
    const custom = await $.store.get(STORE_ACTIONS)
    await update($, customState, () => (Array.isArray(custom) ? (custom as Array<CustomAction>) : []))
    const layout = await $.store.get(STORE_LAYOUT)
    await update($, layoutState, () => (layout === 'separate' ? 'separate' : 'one'))
  } catch (error) {
    $.ui.log(`refresh failed: ${String(error)}`, { to: 'debug' })
  }
}

async function writeCustom($: EngineInterface, custom: Array<CustomAction>) {
  await $.store.set(STORE_ACTIONS, custom)
  await update($, customState, () => custom)
}

async function writeLayout($: EngineInterface, layout: BandLayout) {
  await $.store.set(STORE_LAYOUT, layout)
  await update($, layoutState, () => layout)
}

/**
 * Opens the pane and says in the transcript when it is not drawn. Called before
 * any other await of a press, so the engine counts the open as the person's: a
 * pane opened unasked waits undrawn below 144 terminal columns.
 */
async function openPane($: EngineInterface) {
  const opened = await $.ui.open(PANE_OPTIONS)
  await update($, paneOpenState, () => opened.isPlaced)
  if (!opened.isPlaced) {
    $.ui.log(`The quick actions pane is open but not drawn: ${JSON.stringify(opened.reason)}`)
  }
}

/**
 * Closes the pane. A close the mod makes itself does not always reach its own
 * close hook, so the open flag is cleared here as well.
 */
async function closePane($: EngineInterface) {
  await $.ui.close({ id: PANE })
  await update($, paneOpenState, () => false)
}

/** Runs a press's work, and says in the transcript when it fails; a press has no caller to report to. */
function report($: EngineInterface, what: string, work: Promise<unknown>) {
  work.catch(error => $.ui.log(`Quick actions: ${what} failed: ${String(error)}`))
}

/** Opens the pane on the list of actions. */
async function openList($: EngineInterface) {
  const opened = openPane($)
  await update($, draftState, () => null)
  await opened
}

/**
 * Opens the pane on the form for a new action. From the band it is prefilled
 * with what the prompt box holds; from the list it starts empty.
 */
async function startAdd($: EngineInterface, returnTo: Draft['returnTo']) {
  const opened = openPane($)
  const text = returnTo === 'band' ? (await $.prompt.read()).text : ''
  await update($, draftState, () => draftFromPrompt(text, returnTo))
  await opened
}

async function startEdit($: EngineInterface, action: CustomAction) {
  /** Actions saved before icons and colors existed have neither field. A command shows with its slash, as typed. */
  await update($, draftState, () => ({
    ...action,
    text: action.kind === 'command' ? `/${action.text}` : action.text,
    icon: action.icon ?? '',
    color: action.color ?? '',
    source: null,
    returnTo: 'list' as const,
    error: null,
    picking: null,
  }))
}

/** Leaves the form: back to the list, or closes the pane when the form was opened from the band. */
async function leaveForm($: EngineInterface, draft: Draft) {
  await update($, draftState, () => null)
  if (draft.returnTo === 'band') {
    await closePane($)
  }
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
    icon: draft.icon,
    color: draft.color,
    kind: draft.kind,
    text: normalizeText(draft.kind, draft.text),
  }
  await writeCustom($, draft.id === null ? [...custom, saved] : custom.map(action => (action.id === draft.id ? saved : action)))

  /** The prompt box text became the action, so it is cleared, unless the person changed it meanwhile. */
  if (draft.source !== null && (await $.prompt.read()).text.trim() === draft.source) {
    await $.prompt.fill({ text: '' })
  }
  await leaveForm($, draft)
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

/** How long a shell action may run before it is killed. */
const SHELL_TIMEOUT_MS = 120_000

async function runShell($: EngineInterface, argv: Array<string>) {
  const line = argv[0] === 'sh' && argv[1] === '-c' ? (argv[2] ?? '') : argv.join(' ')
  $.ui.toast(`${line} …`)
  try {
    const { exitCode, stdout, stderr } = await $.process.run(argv, { timeoutMs: SHELL_TIMEOUT_MS })
    const output = `${stdout}${stderr}`.trim()
    $.ui.log(`$ ${line}${output === '' ? '' : `\n${output}`}${exitCode === 0 ? '' : `\nexit ${exitCode}`}`)
    $.ui.toast(exitCode === 0 ? `${line}: done` : `${line}: failed (exit ${exitCode})`)
  } catch (error) {
    $.ui.log(`$ ${line}\n${String(error)}`)
    $.ui.toast(`${line}: did not run`)
  }
  await refresh($)
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
    await refresh($)
    $.clock.every(REFRESH_MS, () => void refresh($))
    return started
  })

  on('turn.complete', async ($, e, next) => {
    const completed = await next(e)
    await refresh($)
    return completed
  })

  on('classic.CwdChanged', async ($, e, next) => {
    const changed = await next(e)
    await refresh($)
    return changed
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
      return { value: undefined }
    }
    if (draft.returnTo === 'list') {
      await update($, draftState, () => null)
      return { value: undefined }
    }
    return close()
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }
    /** Null outside a git repository: the actions still show, only the git counts are left out. */
    const git = await read($, gitState)
    const isPaneOpen = await read($, paneOpenState)

    const { Box, Button, Text } = $.ui.resolve(e)
    const shown = (await read($, customState)).map(toAction)
    const layout = await read($, layoutState)

    /** One action: a bracketed button with the icon inside the label; the hotkey works but is not drawn. */
    const item = (action: Action) => (
      <Button
        key={action.key}
        label={`${action.icon !== undefined ? `${action.icon} ` : ''}${action.label}`}
        hotkey={action.hotkey}
        onPress={() => void run($, action)}
      />
    )

    const status =
      git === null
        ? []
        : [
            git.isDirty ? '*' : '',
            git.ahead > 0 ? `↑${git.ahead}` : '',
            git.behind > 0 ? `↓${git.behind}` : '',
            git.baseBehind > 0 ? `${git.base?.replace(/^origin\//, '')}↓${git.baseBehind}` : '',
          ].filter(part => part !== '')

    const controls = (
      <Box key="controls" flexDirection="row" columnGap={1} flexShrink={0}>
        {status.length > 0 && <Text color="yellow">{status.join(' ')} </Text>}
        <Button key="add" label="+" variant="primary" onPress={() => report($, 'opening the form', startAdd($, 'band'))} />
        {/* Opens the list, or closes the pane when it is open in any view. */}
        <Button
          key="manage"
          label="≡"
          onPress={() =>
            isPaneOpen ? report($, 'closing the pane', closePane($)) : report($, 'opening the list', openList($))
          }
        />
      </Box>
    )

    /**
     * One row of the band: its actions left, after the section's symbol when
     * given, and the controls right on the first row only.
     */
    const row = (key: string, actions: Array<Action>, section: (typeof SECTIONS)[number] | null, isFirst: boolean) => (
      <Box key={key} flexDirection="row" justifyContent="space-between" columnGap={2}>
        {/* No wrapping: a wrapping row that may shrink reserves a second, empty line. Room past the
            band's width is cut instead. */}
        <Box flexDirection="row" columnGap={2} flexShrink={1} overflow="hidden">
          {section !== null && (
            <Text key={`symbol-${section.id}`} bold color={section.color}>
              {section.symbol}
            </Text>
          )}
          {actions.map(item)}
        </Box>
        {isFirst && controls}
      </Box>
    )

    /** Separate bands leave out the sections without actions; with no actions at all one row holds the controls. */
    const rows =
      layout === 'separate'
        ? SECTIONS.map(section => ({ section, actions: shown.filter(action => sectionOf(action.kind) === section.id) })).filter(
            ({ actions }) => actions.length > 0,
          )
        : []
    return (
      <Box flexDirection="column" paddingLeft={1} paddingRight={3} marginTop={1}>
        {/* The right padding keeps the last button off the band's own collapse control. */}
        {rows.length === 0
          ? row('row', shown, null, true)
          : rows.map(({ section, actions }, index) => row(`row-${section.id}`, actions, section, index === 0))}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface === 'mobile') {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>Manage quick actions in the terminal or the desktop app.</Text>
    }
    const { Box, Button, Input, Text } = $.ui.resolve(e)
    const draft = await read($, draftState)
    const custom = await read($, customState)
    const pendingDelete = await read($, pendingDeleteState)
    const layout = await read($, layoutState)
    const close = () => report($, 'closing the pane', closePane($))

    /**
     * A pane opened inline above the prompt gets the engine's own close mark;
     * only a docked pane (the fullscreen layout) needs one of ours.
     */
    const isDocked = e.viewport?.isFullscreen !== false
    const header = (title: string) => (
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold>{title}</Text>
        {isDocked && <Button key="close" label="✕" plain dimColor role="dismiss" onPress={close} />}
      </Box>
    )

    /** An icon in its color, or nothing for an action without one. */
    const icon = (action: { icon?: string; color?: string }, isDim = false) =>
      action.icon ? (
        <Text color={action.color || undefined} bold dimColor={isDim}>
          {action.icon}
        </Text>
      ) : null

    if (draft !== null) {
      const field = TEXT_FIELDS[draft.kind]
      /** Digits another action already uses are left out, so a clash cannot be picked. */
      const used = new Set(custom.filter(action => action.id !== draft.id).map(action => action.hotkey))
      const hotkeyOptions = [{ value: '', label: 'none' }, ...HOTKEYS.filter(digit => !used.has(digit)).map(digit => ({ value: digit, label: digit }))]

      const settings: Array<{ id: DraftSetting; title: string; question: string; options: ReadonlyArray<Option> }> = [
        { id: 'kind', title: 'Type', question: 'What pressing the button does', options: KINDS },
        { id: 'icon', title: 'Icon', question: 'The symbol shown in the button', options: ICON_OPTIONS },
        { id: 'color', title: 'Color', question: 'The color of the icon', options: COLOR_OPTIONS },
        { id: 'hotkey', title: 'Hotkey', question: 'The digit that presses the button from an empty prompt box', options: hotkeyOptions },
      ]
      const valueOf = (id: DraftSetting) => draft[id]

      /**
       * A button label takes no color, so colored text beside it shows what a
       * value looks like: a swatch for a color, the icon in the chosen color.
       */
      const swatch = (id: DraftSetting, value: string) => {
        if (id === 'color') {
          return <Text color={value || undefined}>■■■</Text>
        }
        if (id === 'icon' && value !== '') {
          return (
            <Text color={draft.color || undefined} bold>
              {value}
            </Text>
          )
        }
        return null
      }

      /**
       * The option list of one setting, in place of the form, as the config menu
       * opens one: the current option ticked and focused, a press picks it and
       * returns to the form, Esc returns without a change.
       */
      const picking = settings.find(setting => setting.id === draft.picking)
      if (picking !== undefined) {
        const current = valueOf(picking.id)
        /** Labels padded to the longest, so the swatches and hints start in one column. */
        const width = Math.max(...picking.options.map(option => option.label.length))
        return (
          <Box flexDirection="column" rowGap={1} paddingX={1}>
            {header(picking.title)}
            <Text bold>{picking.question}</Text>
            <Box flexDirection="column">
              {picking.options.map(option => (
                <Box key={`option-row-${option.value || 'none'}`} flexDirection="row" columnGap={2}>
                  <Button
                    key={`${picking.id}-${option.value || 'none'}`}
                    label={`${option.value === current ? '✔' : ' '} ${option.label.padEnd(width)}`}
                    plain
                    autoFocus={option.value === current ? true : undefined}
                    onPress={() => void editDraft($, { [picking.id]: option.value, picking: null })}
                  />
                  {swatch(picking.id, option.value)}
                  {option.hint !== undefined && <Text dimColor>{option.hint}</Text>}
                </Box>
              ))}
            </Box>
            <Text dimColor italic>
              Enter to select · Esc to go back
            </Text>
          </Box>
        )
      }

      /** One setting per row, its name left and its value right, as the config menu lists them. */
      const settingRow = (setting: (typeof settings)[number]) => {
        const option = setting.options.find(one => one.value === valueOf(setting.id)) ?? setting.options[0]
        return (
          <Box key={`setting-row-${setting.id}`} flexDirection="row" columnGap={2}>
            <Button
              key={`setting-${setting.id}`}
              label={`${setting.title.padEnd(10)}${option?.label ?? ''} ›`}
              plain
              onPress={() => void editDraft($, { picking: setting.id })}
            />
            {swatch(setting.id, valueOf(setting.id))}
          </Box>
        )
      }

      return (
        <Box flexDirection="column" rowGap={1} paddingX={1}>
          {header(draft.id === null ? 'New quick action' : 'Edit quick action')}
          <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
            {settings.map(settingRow)}
          </Box>
          <Box flexDirection="column">
            <Text dimColor>Label, shown on the button</Text>
            <Box borderStyle="round" paddingX={1}>
              <Input
                key="label"
                placeholder="review diff"
                value={draft.label}
                submitLabel="save"
                onInput={value => void editDraft($, { label: value })}
                onSubmit={value => void editDraft($, { label: value }).then(() => saveDraft($))}
              />
            </Box>
          </Box>
          <Box flexDirection="column">
            <Box flexDirection="row" justifyContent="space-between">
              <Text dimColor>{field.title}</Text>
              <Text dimColor>Enter adds a line</Text>
            </Box>
            <Box borderStyle="round" paddingX={1} minHeight={8}>
              {/* The input is one line and Enter submits it, so Enter appends a line break and Save saves. */}
              <Input
                key="text"
                placeholder={field.placeholder}
                value={draft.text}
                autoFocus
                submitLabel="new line"
                onInput={value => void editDraft($, { text: value })}
                onSubmit={value => void editDraft($, { text: `${value}\n` })}
              />
            </Box>
          </Box>
          {draft.error !== null && <Text color="red">{draft.error}</Text>}
          <Box flexDirection="row" justifyContent="space-between">
            <Box flexDirection="row" columnGap={1}>
              <Button key="save" label="Save" variant="primary" onPress={() => void saveDraft($)} />
              <Button key="cancel" label="Cancel" onPress={() => void leaveForm($, draft)} />
            </Box>
            <Box flexDirection="row" columnGap={1}>
              <Text dimColor>Button:</Text>
              {icon(draft)}
              <Text>{draft.hotkey !== '' ? `${draft.hotkey}: ` : ''}{draft.label || '…'}</Text>
            </Box>
          </Box>
        </Box>
      )
    }

    const customRow = (action: CustomAction) => {
      const isPeer = (other: CustomAction) => sectionOf(other.kind) === sectionOf(action.kind)
      const peers = custom.filter(isPeer)
      const position = peers.indexOf(action)
      return (
        <Box key={`row-${action.id}`} flexDirection="row" justifyContent="space-between" columnGap={1}>
          <Box flexDirection="row" columnGap={1} flexShrink={1}>
            {icon(action)}
            {/* The label is the way into the action: pressing it opens the form. */}
            <Button key={`edit-${action.id}`} label={action.label} plain onPress={() => void startEdit($, action)} />
            {action.hotkey !== '' && <Text dimColor>[{action.hotkey}]</Text>}
            {action.kind === 'fill' && (
              <Text color="blue" dimColor>
                fill
              </Text>
            )}
          </Box>
          <Box flexDirection="row" columnGap={1} flexShrink={0}>
            <Button
              key={`up-${action.id}`}
              label="↑"
              plain
              dimColor={position > 0}
              onPress={() => void writeCustom($, move(custom, action.id, -1, isPeer))}
            />
            <Button
              key={`down-${action.id}`}
              label="↓"
              plain
              dimColor={position < peers.length - 1}
              onPress={() => void writeCustom($, move(custom, action.id, 1, isPeer))}
            />
            <Button
              key={`delete-${action.id}`}
              label={pendingDelete === action.id ? 'delete? ✕' : '✕'}
              plain
              dimColor={pendingDelete !== action.id}
              onPress={() => void pressDelete($, action)}
            />
          </Box>
        </Box>
      )
    }


    const section = ({ id, title, hint, color, symbol }: (typeof SECTIONS)[number]) => {
      const own = custom.filter(action => sectionOf(action.kind) === id)
      return (
        <Box key={`section-${id}`} flexDirection="column">
          <Box flexDirection="row" columnGap={1}>
            <Text bold color={color}>
              {symbol} {title}
            </Text>
            <Text dimColor>{hint}</Text>
          </Box>
          <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
            {own.map(customRow)}
            {own.length === 0 && <Text dimColor>None yet.</Text>}
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" rowGap={1} paddingX={1}>
        {header('Quick actions')}
        {SECTIONS.map(section)}
        <Box key="section-settings" flexDirection="column">
          <Text bold>Settings</Text>
          <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
            {/* Two values, so a press toggles, as the config menu does for a switch. */}
            <Button
              key="setting-layout"
              label={`${'Bands'.padEnd(10)}${LAYOUTS[layout]} ›`}
              plain
              onPress={() => void writeLayout($, layout === 'one' ? 'separate' : 'one')}
            />
          </Box>
        </Box>
        <Box flexDirection="row" columnGap={2}>
          <Button key="new" label="New action" variant="primary" onPress={() => void startAdd($, 'list')} />
          <Text dimColor>Esc closes</Text>
        </Box>
      </Box>
    )
  })
}
