import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { postEvent } from './post-event.ts';
import type { TelemetryEvent } from './types.ts';

const fetchMock = vi.fn();
const event = { eventId: 'a' } as TelemetryEvent;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ status: 200 });
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const post = async () => {
  const posted = postEvent(event).catch(() => {});
  await vi.runAllTimersAsync();
  return posted;
};

it('posts the event as JSON', async () => {
  await post();

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]).toEqual([
    'https://storybook.js.org/event-log',
    expect.objectContaining({
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }),
  ]);
});

it.each([503, 504])('retries a %i response three times, then stops', async (status) => {
  fetchMock.mockResolvedValue({ status });

  await post();

  expect(fetchMock).toHaveBeenCalledTimes(4);
});

it('retries a network error until the event is delivered', async () => {
  fetchMock.mockRejectedValueOnce(new Error('network'));

  await post();

  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('does not retry any other response', async () => {
  fetchMock.mockResolvedValue({ status: 500 });

  await post();

  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('gives up on an endpoint that does not respond within 30 seconds', async () => {
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
  fetchMock.mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason));
      })
  );

  const posted = postEvent(event);
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  controller.abort();

  await expect(posted).rejects.toThrow();
  expect(timeout).toHaveBeenCalledWith(30_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  timeout.mockRestore();
});
