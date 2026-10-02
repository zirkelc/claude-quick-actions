import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

/** Git output of a feature branch: dirty, 2 ahead of its upstream, 5 behind origin/main. */
const GIT: Record<string, string> = {
  'rev-parse': '/repo/.git\n/repo/.git\n/repo\n',
  status: [
    '# branch.oid 2d72903c48cc12bd46ae3dda91cf10be5cccaa5a',
    '# branch.head feat-x',
    '# branch.upstream origin/feat-x',
    '# branch.ab +2 -0',
    '1 .M N... 100644 100644 100644 abc abc README.md',
  ].join('\n'),
  'symbolic-ref': 'origin/main\n',
  'rev-list': '5\n',
}

function fakeGit(on: On, calls: Array<Array<string>>) {
  on('session.start', () => ({ cwd: '/repo' }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('process.run', ($, e) => {
    const argv = [...e.argv]
    calls.push(argv)
    const sub = argv.find(arg => arg in GIT)
    return {
      value: {
        exitCode: sub === undefined ? 1 : 0,
        stdout: sub === undefined ? '' : (GIT[sub] ?? ''),
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
}

async function mountBand($: Engine) {
  await $.session.start({ cwd: '/repo', surface: 'terminal' } as Parameters<Engine['session']['start']>[0])
  return $.ui.mount({
    plugin: 'quick-actions',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 } as never,
  })
}

const SAVED = [
  { id: 'c1', label: 'commit', hotkey: '1', icon: '', color: '', kind: 'command', text: 'commit --push' },
  { id: 'r1', label: 'review', hotkey: '', icon: '★', color: 'yellow', kind: 'submit', text: 'Review the diff' },
]

test('should draw the git counts and only the saved actions', async ($, on) => {
  // Arrange
  const calls: Array<Array<string>> = []
  fakeGit(on, calls)
  mock.store(on, { actions: SAVED })

  // Act
  const band = await mountBand($)
  const texts = (await band.findAll({ type: 'Text' })).map(found => found.text).join(' ')
  const buttons = (await band.findAll({ type: 'Button' })).map(found => [found.key, found.text])

  // Assert
  expect(texts).toContain('* ↑2 main↓5')
  expect(buttons).toEqual([
    ['custom-c1', 'commit'],
    ['custom-r1', '★ review'],
    ['add', '+'],
    ['manage', '≡'],
  ])
  expect(calls.every(argv => argv.includes('--no-optional-locks'))).toBe(true)
})

test('should run a saved command with its arguments on press', async ($, on) => {
  // Arrange
  fakeGit(on, [])
  mock.store(on, { actions: SAVED })
  const commands: Array<[string, string]> = []
  on('command.run', ($, e) => {
    commands.push([e.command, e.args])
    return { text: '' }
  })
  const band = await mountBand($)

  // Act
  await band.press({ key: 'custom-c1' })

  // Assert
  expect(commands).toEqual([['commit', '--push']])
})

test('should show a saved shell action and run it with sh -c on press', async ($, on) => {
  // Arrange
  const calls: Array<Array<string>> = []
  fakeGit(on, calls)
  mock.store(on, { actions: [{ id: 'x1', label: 'test', hotkey: '2', icon: '', color: '', kind: 'shell', text: 'pnpm test' }] })
  const band = await mountBand($)

  // Act
  const button = await band.find({ key: 'custom-x1' })
  await band.press({ key: 'custom-x1' })

  // Assert
  expect(button?.text).toBe('test')
  expect(calls.filter(argv => argv[0] === 'sh')).toEqual([['sh', '-c', 'pnpm test']])
})

test('should save the prompt box as a new action and clear the box', async ($, on) => {
  // Arrange
  fakeGit(on, [])
  mock.clock(on)
  const store = new Map<string, unknown>()
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  const toasts: Array<string> = []
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  let box = '/release-pr record'
  on('prompt.read', () => ({ value: { text: box, cursor: box.length } }))
  on('prompt.fill', ($, e) => {
    box = e.text
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })
  const opened: Array<string> = []
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true as const } }
  })
  const closed: Array<string> = []
  on('ui.close', ($, e) => {
    closed.push(e.id)
    return { value: undefined }
  })
  const band = await mountBand($)

  // Act
  await band.press({ key: 'add' })
  const pane = await $.ui.mount({
    plugin: 'quick-actions',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'quick-actions',
    props: {} as never,
  })
  const prefilled = await pane.find({ key: 'text' })
  await pane.press({ key: 'setting-hotkey' })
  await pane.press({ key: 'hotkey-1' })
  await pane.press({ key: 'save' })
  const saved = store.get('actions') as Array<{ id: string }>

  // Assert
  expect(opened).toEqual(['quick-actions'])
  expect(closed).toEqual(['quick-actions-edit', 'quick-actions-manage', 'quick-actions'])
  expect(saved).toEqual([
    { id: expect.any(String), label: '/release-pr record', hotkey: '1', icon: '', color: '', kind: 'command', text: 'release-pr record' },
  ])
  expect(prefilled?.props.value).toBe('/release-pr record')
  expect(box).toBe('')
  expect(toasts).toEqual(['Saved "/release-pr record"'])
  expect((await band.find({ key: `custom-${saved[0]?.id}` }))?.text).toBe('/release-pr record')
})

test('should show why a save was refused inside the form', async ($, on) => {
  // Arrange
  fakeGit(on, [])
  mock.store(on)
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  const band = await mountBand($)
  await band.press({ key: 'add' })
  const pane = await $.ui.mount({
    plugin: 'quick-actions',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'quick-actions',
    props: {} as never,
  })

  // Act
  await pane.press({ key: 'save' })
  const error = await pane.find({ type: 'Text', text: 'The label is empty.' })

  // Assert
  expect(error?.text).toBe('The label is empty.')
})
