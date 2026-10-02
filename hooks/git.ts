import type { GitState } from '../types'

/** Parses `git status --porcelain=v2 --branch`: branch headers, then one line per change. */
export function parseStatus(output: string): Pick<GitState, 'branch' | 'sha' | 'upstream' | 'ahead' | 'behind' | 'isDirty'> {
  let branch: string | null = null
  let sha = ''
  let upstream: string | null = null
  let ahead = 0
  let behind = 0
  let isDirty = false

  for (const line of output.split('\n')) {
    if (line.startsWith('# branch.oid ')) {
      sha = line.slice('# branch.oid '.length, '# branch.oid '.length + 7)
    } else if (line.startsWith('# branch.head ')) {
      const head = line.slice('# branch.head '.length)
      branch = head === '(detached)' ? null : head
    } else if (line.startsWith('# branch.upstream ')) {
      upstream = line.slice('# branch.upstream '.length)
    } else if (line.startsWith('# branch.ab ')) {
      const match = /^# branch\.ab \+(\d+) -(\d+)$/.exec(line)
      ahead = Number(match?.[1] ?? 0)
      behind = Number(match?.[2] ?? 0)
    } else if (line !== '' && !line.startsWith('#')) {
      isDirty = true
    }
  }

  return { branch, sha, upstream, ahead, behind, isDirty }
}

export function basename(path: string): string {
  return path.replace(/\/+$/, '').split('/').pop() ?? path
}
