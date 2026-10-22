/**
 * The pane's colors. Its own text stays in the terminal's colors (plain and
 * dim), so it reads in a dark and a light theme, and the colors the person
 * gives the actions are the only strong ones. One orange accent marks the
 * title, the counts and the chosen option.
 */

/** The accent as text: the title mark and the counts. Orange reads on a dark and on a light ground. */
export const ACCENT = '#d97757'

/** The accent as the ground of a chosen option button: darker, so the text on it reads. */
export const ACCENT_GROUND = '#c15f3c'

/** A section's bar: a dark ground with light text. Both are set, so the bar reads in either theme. */
export const BAR_GROUND = '#3d3d3a'
export const BAR_TEXT = '#faf9f5'

/** A non-breaking space, which no surface joins with the spaces next to it. */
const NBSP = ' '

/**
 * Keeps the spaces of padded text. The desktop and remote surfaces join a run
 * of spaces into one, which moves a padded column out of line; there every
 * space becomes a non-breaking space. The terminal keeps spaces as they are.
 */
export function keepSpaces(surface: string): (text: string) => string {
  return surface === 'terminal' ? text => text : text => text.replace(/ /g, NBSP)
}
