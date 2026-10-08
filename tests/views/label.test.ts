import { describe, expect, test, tier } from 'claude-code/testing'

import { shownLabel } from '../../hooks/views/label'

tier('user')

describe('label', () => {
  test('should put a label on one line without control characters', () => {
    // Arrange
    const label = '  review\nthe\tdiff\u0007 '

    // Act
    const shown = shownLabel(label)

    // Assert
    expect(shown).toBe('review the diff')
  })

  test('should cut a long label with an ellipsis', () => {
    // Arrange
    const label = 'abcdefghij'

    // Act
    const shown = shownLabel(label, 5)
    const whole = shownLabel(label, 10)

    // Assert
    expect(shown).toBe('abcd…')
    expect(whole).toBe('abcdefghij')
  })
})
