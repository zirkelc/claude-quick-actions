import { expect, test } from 'claude-code/testing'

import { checkDraft, draftFromPrompt, move, normalizeText, sectionOf, toAction } from '../hooks/actions'

test('should read the kind from the prompt prefix', () => {
  // Arrange
  const inputs = ['/pr --draft', '!  pnpm test', 'review the diff', '']

  // Act
  const drafts = inputs.map(input => draftFromPrompt(input, 'band'))

  // Assert
  expect(drafts.map(draft => [draft.kind, draft.text])).toEqual([
    ['command', '/pr --draft'],
    ['shell', 'pnpm test'],
    ['submit', 'review the diff'],
    ['submit', ''],
  ])
})

test('should refuse a hotkey that is already in use', () => {
  // Arrange
  const draft = { ...draftFromPrompt('/commit', 'band'), hotkey: '1' }

  // Act
  const problem = checkDraft(draft, ['1', '2'])

  // Assert
  expect(problem).toBe('The hotkey "1" is already in use.')
})

test('should split a command action into name and arguments', () => {
  // Arrange
  const custom = { id: 'a', label: 'draft pr', hotkey: '', icon: '', color: 'blue', kind: 'command' as const, text: 'pr --draft now' }

  // Act
  const action = toAction(custom)

  // Assert
  expect(action).toEqual({
    key: 'custom-a',
    label: 'draft pr',
    hotkey: undefined,
    icon: undefined,
    color: 'blue',
    kind: 'command',
    command: 'pr',
    args: '--draft now',
  })
})

test('should move an action one place and stop at the ends', () => {
  // Arrange
  const list = ['a', 'b', 'c'].map(id => ({ id, label: id, hotkey: '', icon: '', color: '', kind: 'submit' as const, text: id }))

  // Act
  const down = move(list, 'a', 1).map(action => action.id)
  const top = move(list, 'a', -1).map(action => action.id)

  // Assert
  expect(down).toEqual(['b', 'a', 'c'])
  expect(top).toEqual(['a', 'b', 'c'])
})

test('should refuse a letter as hotkey', () => {
  // Arrange
  const draft = { ...draftFromPrompt('/commit', 'band'), hotkey: 'c' }

  // Act
  const problem = checkDraft(draft, [])

  // Assert
  expect(problem).toBe('The hotkey must be one digit.')
})

test('should move an action past others to the next one of its section', () => {
  // Arrange
  const kinds = [['a', 'command'], ['b', 'shell'], ['c', 'command']] as const
  const list = kinds.map(([id, kind]) => ({ id, label: id, hotkey: '', icon: '', color: '', kind, text: id }))
  const isCommand = (action: { kind: string }) => sectionOf(action.kind as 'command') === 'commands'

  // Act
  const moved = move(list, 'a', 1, isCommand).map(action => action.id)

  // Assert
  expect(moved).toEqual(['c', 'b', 'a'])
})

test('should accept a command typed with its slash and a shell command typed with !', () => {
  // Arrange
  const draft = { ...draftFromPrompt('', 'list'), kind: 'command' as const, label: 'commit', text: '/commit --push' }

  // Act
  const problem = checkDraft(draft, [])
  const texts = [normalizeText('command', ' /commit --push'), normalizeText('shell', '! pnpm test'), normalizeText('submit', ' /pr ')]

  // Assert
  expect(problem).toBe(null)
  expect(texts).toEqual(['commit --push', 'pnpm test', '/pr'])
})
