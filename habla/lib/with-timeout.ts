export const SPEAKING_EVAL_TIMEOUT_MS = 15_000;
export const LESSON_ANALYSIS_TIMEOUT_MS = 15_000;
export const WRITING_EVAL_TIMEOUT_MS = 30_000;

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Reject if `promise` does not settle within `ms` milliseconds. */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(label ?? `Timed out after ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
