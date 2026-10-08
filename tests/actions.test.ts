import { describe, expect, test, tier } from 'claude-code/testing'

import {
  arrangeOrder,
  checkDraft,
  moveEntry,
  newDraft,
  normalizeText,
  rowsOf,
  sectionOf,
  textColorOn,
  toAction,
  togglePin,
} from '../hooks/actions'

tier('user')

describe('actions', () => {
  test('should refuse a hotkey that is already in use', () => {
    // Arrange
    const draft = { ...newDraft(), kind: 'command' as const, label: 'commit', text: '/commit', hotkey: '1' }

    // Act
    const problem = checkDraft(draft, ['1', '2'])

    // Assert
    expect(problem).toBe('The hotkey "1" is already in use.')
  })

  test('should split a command action into name and arguments', () => {
    // Arrange
    const custom = { id: 'a', label: 'draft pr', hotkey: '', color: 'blue', kind: 'command' as const, text: 'pr --draft now' }

    // Act
    const action = toAction(custom)

    // Assert
    expect(action).toEqual({
      key: 'custom-a',
      label: 'draft pr',
      hotkey: undefined,
      color: 'blue',
      kind: 'command',
      command: 'pr',
      args: '--draft now',
    })
  })

  test('should refuse a letter as hotkey', () => {
    // Arrange
    const draft = { ...newDraft(), kind: 'command' as const, label: 'commit', text: '/commit', hotkey: 'c' }

    // Act
    const problem = checkDraft(draft, [])

    // Assert
    expect(problem).toBe('The hotkey must be one digit.')
  })

  test('should accept a command typed with its slash and a shell command typed with !', () => {
    // Arrange
    const draft = { ...newDraft(), kind: 'command' as const, label: 'commit', text: '/commit --push' }

    // Act
    const problem = checkDraft(draft, [])
    const texts = [normalizeText('command', ' /commit --push'), normalizeText('shell', '! pnpm test'), normalizeText('submit', ' /pr ')]

    // Assert
    expect(problem).toBe(null)
    expect(texts).toEqual(['commit --push', 'pnpm test', '/pr'])
  })

  test('should pick black or white text for the better contrast on a background', () => {
    // Arrange
    const backgrounds = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', '#000080', 'rgb(250,250,210)', 'unknown']

    // Act
    const colors = backgrounds.map(textColorOn)

    // Assert
    expect(colors).toEqual(['white', 'black', 'black', 'white', 'white', 'black', 'black', 'white', 'black', 'white'])
  })

  test('should drop deleted ids and put every action on the band before an order is stored', () => {
    // Arrange
    const stored = ['a', 'gone', 'newline:x', 'b', 'a']

    // Act
    const order = arrangeOrder(stored, ['a', 'b', 'c'])
    const first = arrangeOrder(undefined, ['a', 'b'])

    // Assert
    expect(order).toEqual(['a', 'newline:x', 'b'])
    expect(first).toEqual(['a', 'b'])
  })

  test('should move an entry one place and stop at the ends', () => {
    // Arrange
    const order = ['a', 'newline:x', 'b']

    // Act
    const down = moveEntry(order, 'a', 1)
    const top = moveEntry(order, 'a', -1)

    // Assert
    expect(down).toEqual(['newline:x', 'a', 'b'])
    expect(top).toEqual(['a', 'newline:x', 'b'])
  })

  test('should split the order into band rows at each new line and leave out empty rows', () => {
    // Arrange
    const order = ['newline:x', 'a', 'b', 'newline:y', 'newline:z', 'c', 'newline:w']

    // Act
    const rows = rowsOf(order)

    // Assert
    expect(rows).toEqual([['a', 'b'], ['c']])
  })

  test('should put an action on the band at the end, and take it off again', () => {
    // Arrange
    const order = ['a', 'newline:x']

    // Act
    const pinned = togglePin(order, 'b')
    const unpinned = togglePin(pinned, 'a')

    // Assert
    expect(pinned).toEqual(['a', 'newline:x', 'b'])
    expect(unpinned).toEqual(['newline:x', 'b'])
  })
})
