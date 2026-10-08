import { LABEL_MAX_CHARS } from '../limits'

/** Characters a label cannot draw: control characters, which would break the row. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g

/** A label as the band and the list draw it: on one line, without control characters, and cut with an ellipsis past the limit. */
export function shownLabel(label: string, maxChars = LABEL_MAX_CHARS): string {
  const clean = label.replace(/\s+/g, ' ').replace(CONTROL_CHARACTERS, '').trim()
  const chars = [...clean]
  return chars.length > maxChars ? `${chars.slice(0, maxChars - 1).join('')}…` : clean
}
