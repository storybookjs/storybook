/**
 * `fetch` that gives up on a remote that stalls, without capping how long a large but healthy
 * transfer may take.
 *
 * The idle timer runs while waiting for the response headers and again between body chunks, so a
 * multi-megabyte manifest that keeps streaming is never cut off, while a host that accepts the
 * connection and then goes quiet is. `totalMs` is a backstop for a remote that trickles bytes
 * forever.
 */

export type IdleTimeoutOptions = {
  /** Longest wait for the headers, and then between two body chunks. */
  idleMs: number;
  /** Longest the whole request may take, body included. */
  totalMs: number;
};

export const REMOTE_FETCH_TIMEOUTS: IdleTimeoutOptions = { idleMs: 10_000, totalMs: 60_000 };

/** Raised when a remote stops answering; callers can tell it apart from a definitive failure. */
export class FetchTimeoutError extends Error {
  constructor(url: string, reason: string) {
    super(`Request to ${url} timed out: ${reason}`);
    this.name = 'FetchTimeoutError';
  }
}

/**
 * Fetches `url`, aborting it once the remote stays silent for `idleMs` or the request outlives
 * `totalMs`. The returned response reads like any other, and its body stays guarded by both timers
 * until it has been consumed.
 */
export async function fetchWithIdleTimeout(
  url: string,
  init: RequestInit = {},
  { idleMs, totalMs }: IdleTimeoutOptions = REMOTE_FETCH_TIMEOUTS
): Promise<Response> {
  const controller = new AbortController();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const abort = (reason: string) => controller.abort(new FetchTimeoutError(url, reason));
  const clearTimers = () => {
    clearTimeout(idleTimer);
    clearTimeout(totalTimer);
  };
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => abort(`no data received for ${idleMs}ms`), idleMs);
  };
  const totalTimer = setTimeout(() => abort(`not complete after ${totalMs}ms`), totalMs);
  resetIdle();

  const signal = init.signal
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal;

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal });
  } catch (error) {
    clearTimers();
    throw controller.signal.aborted ? controller.signal.reason : error;
  }

  if (!response.body) {
    clearTimers();
    return response;
  }

  resetIdle();
  const guarded = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, streamController) {
        resetIdle();
        streamController.enqueue(chunk);
      },
      flush: clearTimers,
    })
  );
  // Once the request is aborted, by a timer or by the caller, the timers have nothing left to guard.
  signal.addEventListener('abort', clearTimers, { once: true });

  return new Response(guarded, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
