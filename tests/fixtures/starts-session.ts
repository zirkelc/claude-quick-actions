import type { Args, On } from 'claude-code'
import { mock } from 'claude-code/testing'

/**
 * A session in /repo where every command (a shell action) succeeds with no
 * output, and the slash command registers.
 *
 * @param on the test's `on`
 * @returns every command run, and the mocked clock
 */
export function startsSession(on: On) {
  const runs: Array<Args<'process.run'>> = []
  const clock = mock.clock(on)
  on('session.start', () => ({ cwd: '/repo' }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('process.run', ($, e) => {
    runs.push(e)
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return { runs, clock }
}
