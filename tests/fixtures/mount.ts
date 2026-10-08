import type { MatchedHook, On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

/** What the band beneath the plugin draws; the engine's own drawing by default, as the live band without a survey. */
export type Below = MatchedHook<'ui.render', { component: 'AbovePrompt' }>

/**
 * Starts the session and draws the band through the plugin on the terminal.
 *
 * @param below what the plugins beneath draw
 */
export async function mountBand($: Engine, on: On, { below }: { below?: Below } = {}) {
  on('ui.render', { component: 'AbovePrompt' }, below ?? (() => ({ type: 'engine', ref: 0 })))
  await $.session.start({ cwd: '/repo', surface: 'terminal' } as Parameters<Engine['session']['start']>[0])
  return $.ui.mount({
    plugin: 'quick-actions',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 } as never,
  })
}

/**
 * Draws the pane through the plugin on the terminal.
 *
 * @param columns the pane's width
 */
export function mountPane($: Engine, columns = 100) {
  return $.ui.mount({
    plugin: 'quick-actions',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'quick-actions',
    props: { bodyColumns: columns } as never,
  })
}

/** Runs `/quick-actions`, as the person types it: it opens the pane on the list, or closes it when it is open. */
export function toggleList($: Engine) {
  return $.command.run({ command: 'quick-actions', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
}
