import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import * as memfs from 'memfs';
import { vol } from 'memfs';

import { flushEventsFile } from './flush-events-file.ts';

vi.mock('node:fs/promises', { spy: true });

const file = '/tmp/storybook-telemetry-abc.json';
const fetchMock = vi.fn();

const postedEvents = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));

beforeEach(async () => {
  vol.reset();
  const fs = await import('node:fs/promises');
  vi.mocked(fs.readFile).mockImplementation(memfs.fs.promises.readFile as any);
  vi.mocked(fs.rm).mockImplementation(memfs.fs.promises.rm as any);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ status: 200 });
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const flush = async () => {
  const flushed = flushEventsFile(file);
  await vi.runAllTimersAsync();
  return flushed;
};

it('posts every event in the file as JSON and removes the file', async () => {
  const events = [{ eventId: 'a' }, { eventId: 'b' }];
  vol.fromJSON({ [file]: JSON.stringify(events) });

  await flush();

  expect(postedEvents()).toEqual(events);
  expect(fetchMock.mock.calls[0]).toEqual([
    'https://storybook.js.org/event-log',
    expect.objectContaining({ method: 'post', headers: { 'Content-Type': 'application/json' } }),
  ]);
  expect(vol.existsSync(file)).toBe(false);
});

it.each([503, 504])('retries a %i response three times', async (status) => {
  fetchMock.mockResolvedValue({ status });
  vol.fromJSON({ [file]: JSON.stringify([{ eventId: 'a' }]) });

  await flush();

  expect(fetchMock).toHaveBeenCalledTimes(4);
});

it('retries a network error until the event is delivered', async () => {
  fetchMock.mockRejectedValueOnce(new Error('network'));
  vol.fromJSON({ [file]: JSON.stringify([{ eventId: 'a' }]) });

  await flush();

  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('does not retry any other response', async () => {
  fetchMock.mockResolvedValue({ status: 500 });
  vol.fromJSON({ [file]: JSON.stringify([{ eventId: 'a' }]) });

  await flush();

  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('delivers the other events when one cannot be delivered', async () => {
  fetchMock.mockImplementation(async (_url, init) => {
    if (JSON.parse(init.body).eventId === 'a') {
      throw new Error('network');
    }
    return { status: 200 };
  });
  vol.fromJSON({ [file]: JSON.stringify([{ eventId: 'a' }, { eventId: 'b' }]) });

  await expect(flush()).resolves.toBeUndefined();

  expect(postedEvents()).toContainEqual({ eventId: 'b' });
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
  vol.fromJSON({ [file]: JSON.stringify([{ eventId: 'a' }]) });

  const flushed = flushEventsFile(file);
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  controller.abort();

  await expect(flushed).resolves.toBeUndefined();
  expect(timeout).toHaveBeenCalledWith(30_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  timeout.mockRestore();
});

it('removes a file it cannot parse', async () => {
  vol.fromJSON({ [file]: '[{"eventId":' });

  await expect(flushEventsFile(file)).rejects.toThrow();

  expect(vol.existsSync(file)).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});
