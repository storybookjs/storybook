import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sourceUrlManifestProvider } from './access-provider.ts';
import { FetchTimeoutError, fetchWithIdleTimeout } from './fetch-with-idle-timeout.ts';

const encoder = new TextEncoder();

// `end: false` leaves the body open after the last chunk, as a stalled remote would.
function streamingFetch({
  headersAfterMs = 0,
  chunks,
  end = true,
  headers = { 'content-type': 'application/json' },
}: {
  headersAfterMs?: number;
  chunks: Array<{ afterMs: number; data: string }>;
  end?: boolean;
  headers?: Record<string, string>;
}) {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    const signal = init?.signal;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, headersAfterMs);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason);
      });
    });

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        signal?.addEventListener('abort', () => controller.error(signal.reason));
        for (const { afterMs, data } of chunks) {
          await new Promise((resolve) => setTimeout(resolve, afterMs));
          if (signal?.aborted) return;
          controller.enqueue(encoder.encode(data));
        }
        if (end) controller.close();
      },
    });
    return new Response(body, { headers });
  });
}

describe('fetchWithIdleTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('lets a body that keeps arriving take longer than the idle timeout', async () => {
    vi.stubGlobal(
      'fetch',
      streamingFetch({
        headersAfterMs: 800,
        chunks: Array.from({ length: 10 }, (_, i) => ({ afterMs: 800, data: String(i) })),
      })
    );

    const result = fetchWithIdleTimeout(
      'https://ref.example',
      {},
      { idleMs: 1_000, totalMs: 60_000 }
    ).then((response) => response.text());
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(result).resolves.toBe('0123456789');
  });

  it('gives up when the headers do not arrive within the idle timeout', async () => {
    vi.stubGlobal('fetch', streamingFetch({ headersAfterMs: 5_000, chunks: [] }));

    const result = fetchWithIdleTimeout(
      'https://ref.example',
      {},
      { idleMs: 1_000, totalMs: 60_000 }
    );
    const assertion = expect(result).rejects.toThrow(FetchTimeoutError);
    await vi.advanceTimersByTimeAsync(1_000);

    await assertion;
  });

  it('gives up when the body stalls', async () => {
    vi.stubGlobal(
      'fetch',
      streamingFetch({ chunks: [{ afterMs: 100, data: '{"partial":' }], end: false })
    );

    const result = fetchWithIdleTimeout(
      'https://ref.example',
      {},
      { idleMs: 1_000, totalMs: 60_000 }
    ).then((response) => response.text());
    const assertion = expect(result).rejects.toThrow(/no data received for 1000ms/);
    await vi.advanceTimersByTimeAsync(2_000);

    await assertion;
  });

  it('gives up on a body that trickles past the total budget', async () => {
    vi.stubGlobal(
      'fetch',
      streamingFetch({
        chunks: Array.from({ length: 100 }, () => ({ afterMs: 500, data: '.' })),
      })
    );

    const result = fetchWithIdleTimeout(
      'https://ref.example',
      {},
      { idleMs: 1_000, totalMs: 5_000 }
    ).then((response) => response.text());
    const assertion = expect(result).rejects.toThrow(/not complete after 5000ms/);
    await vi.advanceTimersByTimeAsync(6_000);

    await assertion;
  });

  it('leaves no timers behind once the body has been read', async () => {
    vi.stubGlobal('fetch', streamingFetch({ chunks: [{ afterMs: 10, data: '{}' }] }));

    const result = fetchWithIdleTimeout('https://ref.example').then((response) => response.text());
    await vi.advanceTimersByTimeAsync(10);

    await expect(result).resolves.toBe('{}');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('sourceUrlManifestProvider timeouts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reads a large manifest that streams for longer than a few seconds', async () => {
    // ~2 MB in 64 KB chunks, 250ms apart: about 8 seconds end to end.
    const chunk = 'x'.repeat(64 * 1024);
    vi.stubGlobal(
      'fetch',
      streamingFetch({
        headersAfterMs: 1_500,
        chunks: Array.from({ length: 32 }, () => ({ afterMs: 250, data: chunk })),
      })
    );

    const result = sourceUrlManifestProvider(undefined, './manifests/components.json', {
      id: 'ds',
      title: 'DS',
      url: 'https://ds.example.com',
    });
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(result).resolves.toHaveLength(32 * chunk.length);
  });
});
