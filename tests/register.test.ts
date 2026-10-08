import { describe, expect, mock, test, tier } from 'claude-code/testing'

import { memoryStore, mountBand, mountPane, SAVED, startsSession, toggleList } from './fixtures'

tier('user')

describe('register', () => {
  test('should draw only the actions on the band', async ($, on) => {
    // Arrange
    const { runs } = startsSession(on)
    mock.store(on, { actions: SAVED })

    // Act
    const band = await mountBand($, on)
    const texts = (await band.findAll({ type: 'Text' })).map(found => found.text)
    const buttons = (await band.findAll({ type: 'Button' })).map(found => [found.key, found.text])

    // Assert
    expect(texts).toEqual([])
    expect(buttons).toEqual([
      ['custom-c1', 'commit'],
      ['custom-r1', 'review'],
    ])
    expect(runs).toEqual([])
  })

  test('should draw no band when nothing is on it, and leave the band of a plugin beneath', async ($, on) => {
    // Arrange
    startsSession(on)
    mock.store(on, { actions: SAVED, order: ['newline:x'] })

    // Act
    const band = await mountBand($, on, {
      below: ($, e) => {
        const { Button } = $.ui.resolve(e)
        return Button({ key: 'below', label: 'source control', onPress: () => {} })
      },
    })
    const buttons = (await band.findAll({ type: 'Button' })).map(found => found.key)

    // Assert
    expect(buttons).toEqual(['below'])
  })

  test('should run a saved command with its arguments on press', async ($, on) => {
    // Arrange
    startsSession(on)
    mock.store(on, { actions: SAVED })
    const commands: Array<[string, string]> = []
    on('command.run', ($, e) => {
      commands.push([e.command, e.args])
      return { text: '' }
    })
    const band = await mountBand($, on)

    // Act
    await band.press({ key: 'custom-c1' })

    // Assert
    expect(commands).toEqual([['commit', '--push']])
  })

  test('should show a saved shell action and run it with sh -c on press', async ($, on) => {
    // Arrange
    const { runs } = startsSession(on)
    mock.store(on, { actions: [{ id: 'x1', label: 'test', hotkey: '2', color: '', kind: 'shell', text: 'pnpm test' }] })
    const band = await mountBand($, on)

    // Act
    const button = await band.find({ key: 'custom-x1' })
    await band.press({ key: 'custom-x1' })

    // Assert
    expect(button?.text).toBe('test')
    expect(runs.map(run => [...run.argv]).filter(argv => argv[0] === 'sh')).toEqual([['sh', '-c', 'pnpm test']])
  })

  test('should save a new action from the form and put it on the band', async ($, on) => {
    // Arrange
    startsSession(on)
    const store = memoryStore(on)
    const toasts: Array<string> = []
    on('ui.toast', ($, e) => {
      toasts.push(e.text)
      return { value: undefined }
    })
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    const band = await mountBand($, on)
    await toggleList($)
    const pane = await mountPane($)

    // Act
    await pane.press({ key: 'new' })
    await pane.press({ key: 'kind-command' })
    await pane.input({ key: 'label', text: 'release', kind: 'change' })
    await pane.input({ key: 'text', text: '/release-pr record', kind: 'change' })
    await pane.press({ key: 'hotkey-1' })
    await pane.press({ key: 'save' })
    const saved = store.get('actions') as Array<{ id: string }>

    // Assert
    expect(saved).toEqual([{ id: expect.any(String), label: 'release', hotkey: '1', color: '', kind: 'command', text: 'release-pr record' }])
    expect(store.get('order')).toEqual([saved[0]?.id])
    expect(toasts).toEqual(['Saved "release"'])
    expect((await band.find({ key: `custom-${saved[0]?.id}` }))?.text).toBe('release')
    expect((await pane.find({ key: 'new' }))?.text).toBe('Add action')
  })

  test('should show why a save was refused inside the form', async ($, on) => {
    // Arrange
    startsSession(on)
    mock.store(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    await mountBand($, on)
    await toggleList($)
    const pane = await mountPane($)
    await pane.press({ key: 'new' })

    // Act
    await pane.press({ key: 'save' })
    const error = await pane.find({ type: 'Text', text: 'The label is empty.' })

    // Assert
    expect(error?.text).toBe('The label is empty.')
  })

  test('should preview the button in the picked color with contrasting text', async ($, on) => {
    // Arrange
    startsSession(on)
    mock.store(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    await mountBand($, on)
    await toggleList($)
    const pane = await mountPane($)
    await pane.press({ key: 'new' })

    // Act
    await pane.input({ key: 'label', text: 'review the diff', kind: 'change' })
    await pane.press({ key: 'color-yellow' })
    const preview = await pane.find({ type: 'Text', text: ' review the diff ' })
    const types = (await pane.findAll({ type: 'Button' })).map(found => found.key).filter(key => key?.startsWith('kind-'))

    // Assert
    expect([preview?.props.backgroundColor, preview?.props.color]).toEqual(['yellow', 'black'])
    expect(types).toEqual(['kind-command', 'kind-fill', 'kind-submit', 'kind-shell'])
  })

  test('should draw an action with a color as a block in that color, and one without as its plain label', async ($, on) => {
    // Arrange
    startsSession(on)
    mock.store(on, { actions: SAVED })

    // Act
    const band = await mountBand($, on)
    const blocks = (await band.findAll({ type: 'Box' }))
      .filter(found => found.props.backgroundColor !== undefined)
      .map(found => [found.key, found.props.backgroundColor])
    const buttons = (await band.findAll({ type: 'Button' })).map(found => [found.key, found.props.plain ?? false])

    // Assert
    expect(blocks).toEqual([['block-custom-r1', 'yellow']])
    expect(buttons).toEqual([
      ['custom-c1', true],
      ['custom-r1', true],
    ])
  })

  test('should draw the band of a plugin beneath under its own', async ($, on) => {
    // Arrange
    startsSession(on)
    mock.store(on, { actions: SAVED })

    // Act
    const band = await mountBand($, on, {
      below: ($, e) => {
        const { Button } = $.ui.resolve(e)
        return Button({ key: 'below', label: 'source control', onPress: () => {} })
      },
    })
    const buttons = (await band.findAll({ type: 'Button' })).map(found => found.key)

    // Assert
    expect(buttons).toEqual(['custom-c1', 'custom-r1', 'below'])
  })



  test('should draw the band in rows split at the new lines of the stored order', async ($, on) => {
    // Arrange
    startsSession(on)
    mock.store(on, { actions: SAVED, order: ['r1', 'newline:x', 'c1'] })

    // Act
    const band = await mountBand($, on)
    const rows = (await band.findAll({ type: 'Box' })).map(found => found.key).filter(key => key?.startsWith('row'))
    const buttons = (await band.findAll({ type: 'Button' })).map(found => found.key)

    // Assert
    expect(rows).toEqual(['row-0', 'row-1'])
    expect(buttons).toEqual(['custom-r1', 'custom-c1'])
  })

  test('should add a new line from the list and move it to start a second band row', async ($, on) => {
    // Arrange
    startsSession(on)
    const store = memoryStore(on, { actions: SAVED })
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    const band = await mountBand($, on)
    await toggleList($)
    const pane = await mountPane($)

    // Act
    await pane.press({ key: 'newline' })
    const newline = (store.get('order') as Array<string>)[2] ?? ''
    await pane.press({ key: `up-${newline}` })
    const symbols = (await pane.findAll({ type: 'Text' })).map(found => found.text).filter(text => ['/', '>', '$', '↵'].includes(text))
    const rows = (await band.findAll({ type: 'Box' })).map(found => found.key).filter(key => key?.startsWith('row'))

    // Assert
    expect(store.get('order')).toEqual(['c1', newline, 'r1'])
    /** The list of all actions first, then the band with its new line. */
    expect(symbols).toEqual(['/', '>', '/', '↵', '>'])
    expect(rows).toEqual(['row-0', 'row-1'])
  })

  test('should show the list in the band when the pane has no room to draw', async ($, on) => {
    // Arrange
    startsSession(on)
    memoryStore(on, { actions: SAVED })
    on('ui.open', () => ({ value: { isPlaced: false as const, reason: 'no room' } }))
    const closed: Array<string> = []
    on('ui.close', ($, e) => {
      closed.push(e.id)
      return { value: undefined }
    })
    const band = await mountBand($, on)

    // Act
    await toggleList($)
    const inBand = await band.find({ key: 'new' })
    await band.press({ key: 'close' })
    const afterClose = await band.find({ key: 'custom-c1' })

    // Assert
    expect(inBand?.key).toBe('new')
    expect(afterClose?.key).toBe('custom-c1')
    expect(closed.filter(id => id === 'quick-actions')).toEqual(['quick-actions', 'quick-actions'])
  })

  test('should open and close the pane with the slash command', async ($, on) => {
    // Arrange
    startsSession(on)
    mock.store(on)
    const calls: Array<string> = []
    on('ui.open', ($, e) => {
      calls.push(`open ${e.id}`)
      return { value: { isPlaced: true as const } }
    })
    on('ui.close', ($, e) => {
      calls.push(`close ${e.id}`)
      return { value: undefined }
    })
    await mountBand($, on)
    const command = { command: 'quick-actions', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 120 } }

    // Act
    await $.command.run(command)
    await $.command.run(command)

    // Assert
    expect(calls.filter(call => call.endsWith(' quick-actions'))).toEqual(['open quick-actions', 'close quick-actions'])
  })

  test('should cut a long label on the band', async ($, on) => {
    // Arrange
    startsSession(on)
    mock.store(on, {
      actions: [{ id: 'l1', label: 'review the whole diff for bugs and style', hotkey: '', color: '', kind: 'submit', text: 'Review' }],
    })

    // Act
    const band = await mountBand($, on)
    const label = (await band.find({ key: 'custom-l1' }))?.text

    // Assert
    expect(label).toBe('review the whole diff f…')
  })

  test('should keep an action off the band and put it on with its star', async ($, on) => {
    // Arrange
    startsSession(on)
    const store = memoryStore(on, { actions: SAVED, order: ['c1'] })
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    const band = await mountBand($, on)
    const before = (await band.findAll({ type: 'Button' })).map(found => found.key)
    await toggleList($)
    const pane = await mountPane($)
    const listed = (await pane.findAll({ type: 'Button' })).map(found => found.key).filter(key => key?.startsWith('edit-'))

    // Act
    await pane.press({ key: 'pin-r1' })
    const after = (await band.findAll({ type: 'Button' })).map(found => found.key)

    // Assert
    expect(before).toEqual(['custom-c1'])
    expect(listed).toEqual(['edit-c1', 'edit-r1'])
    expect(store.get('order')).toEqual(['c1', 'r1'])
    expect(after).toEqual(['custom-c1', 'custom-r1'])
  })

  test('should run an action from the list', async ($, on) => {
    // Arrange
    startsSession(on)
    mock.store(on, { actions: SAVED, order: [] })
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    const commands: Array<[string, string]> = []
    on('command.run', ($, e) => {
      commands.push([e.command, e.args])
      return { text: '' }
    })
    const band = await mountBand($, on)
    await toggleList($)
    const pane = await mountPane($)

    // Act
    await pane.press({ key: 'run-c1' })

    // Assert
    expect(commands).toEqual([['commit', '--push']])
  })

  test('should show the options as buttons when they fit, and as a list to pick from when not', async ($, on) => {
    // Arrange
    startsSession(on)
    mock.store(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    await mountBand($, on)
    await toggleList($)

    // Act
    const wide = await mountPane($, 100)
    await wide.press({ key: 'new' })
    const wideKeys = (await wide.findAll({ type: 'Button' })).map(found => found.key)
    await wide.press({ key: 'color-red' })
    const picked = (await wide.find({ key: 'color-red' }))?.text
    await wide.unmount()
    const narrow = await mountPane($, 40)
    const narrowKeys = (await narrow.findAll({ type: 'Button' })).map(found => found.key)
    await narrow.press({ key: 'setting-color' })
    await narrow.press({ key: 'color-blue' })
    const chosen = (await narrow.find({ key: 'setting-color' }))?.text

    // Assert
    expect(wideKeys.includes('color-yellow') && wideKeys.includes('hotkey-1')).toBe(true)
    expect(wideKeys.includes('setting-color')).toBe(false)
    expect(picked).toBe('✔')
    expect(narrowKeys.includes('setting-color') && narrowKeys.includes('setting-hotkey')).toBe(true)
    expect(chosen).toBe('Color   blue ›')
  })

  test('should pick the type with one button each and name the field for it', async ($, on) => {
    // Arrange
    startsSession(on)
    const store = memoryStore(on, { actions: SAVED })
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    await mountBand($, on)
    await toggleList($)
    const pane = await mountPane($)
    await pane.press({ key: 'edit-r1' })
    const title = async () => (await pane.findAll({ type: 'Text' })).map(found => found.text).find(text => ['Skill', 'Prompt', 'Command'].includes(text))

    // Act
    const forSubmit = await title()
    await pane.press({ key: 'kind-fill' })
    const forFill = await title()
    await pane.press({ key: 'kind-shell' })
    const forShell = await title()
    await pane.press({ key: 'kind-fill' })
    await pane.press({ key: 'save' })

    // Assert
    expect([forSubmit, forFill, forShell]).toEqual(['Prompt', 'Prompt', 'Command'])
    expect((store.get('actions') as Array<{ id: string; kind: string }>).map(action => [action.id, action.kind])).toEqual([
      ['c1', 'command'],
      ['r1', 'fill'],
    ])
  })

  test('should go back from the form to the list with the header button', async ($, on) => {
    // Arrange
    startsSession(on)
    mock.store(on, { actions: SAVED })
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    const band = await mountBand($, on)
    await toggleList($)
    const pane = await mountPane($)
    await pane.press({ key: 'edit-c1' })

    // Act
    const inForm = await pane.find({ key: 'back' })
    await pane.press({ key: 'back' })
    const inList = await pane.find({ key: 'back' })
    const close = await pane.find({ key: 'close' })

    // Assert
    expect(inForm?.text).toBe('← Back')
    expect(inList).toBe(undefined)
    expect(close?.text).toBe('✕ Close')
  })
})

