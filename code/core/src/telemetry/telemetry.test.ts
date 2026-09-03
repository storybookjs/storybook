import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';

import * as memfs from 'memfs';
import { vol } from 'memfs';

import { postEvent } from './post-event.ts';
import { handOffPendingEvents, sendTelemetry } from './telemetry.ts';

vi.mock('./post-event.ts', () => ({ postEvent: vi.fn(async () => {}) }));
vi.mock('./event-cache', () => ({ set: vi.fn() }));
vi.mock('./session-id', () => ({ getSessionId: vi.fn(() => 'session-id') }));
vi.mock('node:fs', { spy: true });
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  spawn: vi.fn(() => ({ unref: vi.fn() })),
}));

const postMock = vi.mocked(postEvent);

const neverResponds = () => new Promise<void>(() => {});

beforeEach(() => {
  vol.reset();
  vol.mkdirSync(os.tmpdir(), { recursive: true });
  vi.mocked(fs.writeFileSync).mockImplementation(memfs.fs.writeFileSync as any);
  vi.mocked(fs.rmSync).mockImplementation(memfs.fs.rmSync as any);
  postMock.mockImplementation(async () => {});
});

afterEach(() => {
  handOffPendingEvents();
  vi.clearAllMocks();
});

const writtenEvents = () =>
  Object.entries(vol.toJSON())
    .filter(([file]) => file.includes('storybook-telemetry-'))
    .map(([file, contents]) => [file, JSON.parse(contents as string)] as const);

it('posts the event with its data and context, without holding the process', async () => {
  await sendTelemetry({ eventType: 'dev', payload: { foo: 'bar' } });

  expect(postMock).toHaveBeenCalledTimes(1);
  const [event, options] = postMock.mock.calls[0];
  expect(event.body).toMatchObject({
    eventType: 'dev',
    payload: { foo: 'bar' },
    sessionId: 'session-id',
    eventId: expect.any(String),
    context: { storybookVersion: expect.any(String) },
  });
  expect(options).toMatchObject({ keepProcessAlive: false });
});

it('returns as soon as the request is started, without waiting for the response', async () => {
  postMock.mockImplementation(neverResponds);

  await sendTelemetry({ eventType: 'dev', payload: {} });

  expect(postMock).toHaveBeenCalledTimes(1);
});

it('waits for the response and holds the process when immediate', async () => {
  let responded = false;
  postMock.mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    responded = true;
  });

  await sendTelemetry({ eventType: 'error', payload: {} }, { immediate: true });

  expect(responded).toBe(true);
  expect(postMock.mock.calls[0][1]).toMatchObject({ keepProcessAlive: true });
});

it('hands events without a response to a detached process on exit, once', async () => {
  postMock.mockImplementation(neverResponds);
  await sendTelemetry({ eventType: 'dev', payload: {} });
  await sendTelemetry({ eventType: 'build', payload: {} }, { retryDelay: 5 });

  handOffPendingEvents();
  handOffPendingEvents();

  expect(writtenEvents()).toEqual([
    [
      expect.stringMatching(/storybook-telemetry-.*\.json$/),
      [
        { body: expect.objectContaining({ eventType: 'dev' }) },
        { body: expect.objectContaining({ eventType: 'build' }), retryDelay: 5 },
      ],
    ],
  ]);

  expect(spawn).toHaveBeenCalledTimes(1);
  const [command, args, options] = vi.mocked(spawn).mock.calls[0];
  expect(command).toBe(process.execPath);
  expect(args).toEqual([expect.stringMatching(/detached-flush/), writtenEvents()[0][0]]);
  expect(options).toMatchObject({ detached: true, stdio: 'ignore' });
});

it('hands off nothing when every response has arrived', async () => {
  await sendTelemetry({ eventType: 'dev', payload: {} });
  await new Promise((resolve) => setTimeout(resolve, 0));

  handOffPendingEvents();

  expect(writtenEvents()).toEqual([]);
  expect(spawn).not.toHaveBeenCalled();
});

it('removes the file again when the detached process cannot be started', async () => {
  postMock.mockImplementation(neverResponds);
  vi.mocked(spawn).mockImplementationOnce(() => {
    throw new Error('EACCES');
  });
  await sendTelemetry({ eventType: 'dev', payload: {} });

  handOffPendingEvents();

  expect(writtenEvents()).toEqual([]);
});

it('still resolves when the session id cannot be read', async () => {
  const { getSessionId } = await import('./session-id.ts');
  vi.mocked(getSessionId).mockImplementationOnce(() => {
    throw new Error('disk');
  });

  await expect(sendTelemetry({ eventType: 'dev', payload: {} })).resolves.toBeUndefined();
  expect(postMock).not.toHaveBeenCalled();
});
