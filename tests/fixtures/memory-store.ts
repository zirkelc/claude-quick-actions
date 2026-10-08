import type { On } from 'claude-code'

/**
 * A store kept in a map the test can read, for asserting what the plugin saved.
 *
 * @param on the test's `on`
 * @param entries what the store holds at the start
 */
export function memoryStore(on: On, entries: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(entries))
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  return store
}
