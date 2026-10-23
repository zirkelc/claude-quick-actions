export type RetryOptions = {
  attempts?: number
  /** Milliseconds to wait before the second attempt; doubles each time. */
  baseDelayMs?: number
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Calls fn until it resolves, at most `attempts` times, with a growing delay. */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3
  const baseDelayMs = options.baseDelayMs ?? 100
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      await sleep(baseDelayMs * 2 ** (attempt - 1))
    }
  }
  throw lastError
}
