import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';

import * as memfs from 'memfs';
import { vol } from 'memfs';

import { set as saveToCache } from './event-cache.ts';
import { ConnectTimeoutError, postEvent } from './post-event.ts';
import { getSessionId } from './session-id.ts';
import { handOffPendingEvents, sendTelemetry } from './telemetry.ts';

vi.mock('./post-event.ts', { spy: true });
vi.mock('./event-cache.ts', { spy: true });
vi.mock('./session-id.ts', { spy: true });
vi.mock('node:fs', { spy: true });
vi.mock('node:child_process', { spy: true });

const postMock = vi.mocked(postEvent);

const neverResponds = () => new Promise<void>(() => {});

beforeEach(() => {
  vol.reset();
  vol.mkdirSync(os.tmpdir(), { recursive: true });
  vi.mocked(fs.writeFileSync).mockImplementation(memfs.fs.writeFileSync as any);
  vi.mocked(fs.rmSync).mockImplementation(memfs.fs.rmSync as any);
  vi.mocked(saveToCache).mockImplementation(async () => {});
  vi.mocked(getSessionId).mockImplementation(() => 'session-id');
  vi.mocked(spawn).mockImplementation(() => ({ pid: 1, unref: vi.fn() }) as any);
  postMock.mockImplementation(async () => {});
});

afterEach(() => {
  handOffPendingEvents();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
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

it('registers the exit hook when loaded', async () => {
  vi.resetModules();
  const once = vi.spyOn(process, 'once');

  await import('./telemetry.ts');

  expect(once).toHaveBeenCalledWith('exit', expect.any(Function));
  once.mockRestore();
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

it('writes the handed-off events to a file only its owner can read', async () => {
  postMock.mockImplementation(neverResponds);
  await sendTelemetry({ eventType: 'dev', payload: {} });

  handOffPendingEvents();

  const [[file]] = writtenEvents();
  expect(vol.statSync(file).mode & 0o777).toBe(0o600);
  expect(vi.mocked(fs.writeFileSync).mock.calls[0][2]).toMatchObject({ flag: 'wx' });
});

it('starts the detached process without the debugger flags of this one', async () => {
  vi.stubEnv('NODE_OPTIONS', '--inspect-brk=0 --max-old-space-size=4096 --inspect');
  postMock.mockImplementation(neverResponds);
  await sendTelemetry({ eventType: 'dev', payload: {} });

  handOffPendingEvents();

  const [, , options] = vi.mocked(spawn).mock.calls[0];
  expect(options.env?.NODE_OPTIONS?.trim()).toBe('--max-old-space-size=4096');
});

it('hands off an event this process gave up connecting for', async () => {
  postMock.mockRejectedValue(new ConnectTimeoutError());
  await sendTelemetry({ eventType: 'dev', payload: {} });
  await new Promise((resolve) => setTimeout(resolve, 0));

  handOffPendingEvents();

  expect(writtenEvents()).toHaveLength(1);
});

it('drops an event that failed for any other reason', async () => {
  postMock.mockRejectedValue(new Error('network'));
  await sendTelemetry({ eventType: 'dev', payload: {} });
  await new Promise((resolve) => setTimeout(resolve, 0));

  handOffPendingEvents();

  expect(writtenEvents()).toEqual([]);
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
  vi.mocked(spawn).mockImplementationOnce(() => ({ pid: undefined, unref: vi.fn() }) as any);
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
