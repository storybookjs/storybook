import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';

import * as memfs from 'memfs';
import { vol } from 'memfs';

import { set as saveToCache } from './event-cache.ts';
import { getSessionId } from './session-id.ts';
import { handOverPendingEvents, sendTelemetry } from './telemetry.ts';

vi.mock('./event-cache.ts', { spy: true });
vi.mock('./session-id.ts', { spy: true });
vi.mock('node:fs', { spy: true });
vi.mock('node:child_process', { spy: true });

const fetchMock = vi.fn();

const childProcess = (pid: number | undefined) =>
  Object.assign(new EventEmitter(), { pid, unref: vi.fn() });

beforeEach(() => {
  vol.reset();
  vol.mkdirSync(os.tmpdir(), { recursive: true });
  vi.mocked(fs.writeFileSync).mockImplementation(memfs.fs.writeFileSync as any);
  vi.mocked(fs.rmSync).mockImplementation(memfs.fs.rmSync as any);
  vi.mocked(saveToCache).mockImplementation(async () => {});
  vi.mocked(getSessionId).mockImplementation(async () => 'session-id');
  vi.mocked(spawn).mockImplementation(() => childProcess(1) as any);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  handOverPendingEvents();
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

const handedOver = () =>
  Object.entries(vol.toJSON())
    .filter(([file]) => file.includes('storybook-telemetry-'))
    .map(([file, contents]) => [file, JSON.parse(contents as string)] as const);

it('hands the events to one detached process, with their data and context', async () => {
  await sendTelemetry({ eventType: 'dev', payload: { foo: 'bar' } });
  await sendTelemetry({ eventType: 'build', payload: {} });

  handOverPendingEvents();
  handOverPendingEvents();

  expect(handedOver()).toEqual([
    [
      expect.stringMatching(/storybook-telemetry-.*\.json$/),
      [
        expect.objectContaining({
          eventType: 'dev',
          payload: { foo: 'bar' },
          sessionId: 'session-id',
          eventId: expect.any(String),
          context: expect.objectContaining({ storybookVersion: expect.any(String) }),
        }),
        expect.objectContaining({ eventType: 'build' }),
      ],
    ],
  ]);

  expect(spawn).toHaveBeenCalledTimes(1);
  const [command, args, options] = vi.mocked(spawn).mock.calls[0];
  expect(command).toBe(process.execPath);
  expect(args).toEqual([expect.stringMatching(/detached-flush/), handedOver()[0][0]]);
  expect(options).toMatchObject({ detached: true, stdio: 'ignore', windowsHide: true });
});

it('never talks to the endpoint itself', async () => {
  await sendTelemetry({ eventType: 'dev', payload: {} });
  handOverPendingEvents();

  expect(fetchMock).not.toHaveBeenCalled();
});

it('saves the event it hands over to the local event cache', async () => {
  await sendTelemetry({ eventType: 'dev', payload: {} });
  handOverPendingEvents();

  const [[, [event]]] = handedOver();
  expect(saveToCache).toHaveBeenCalledWith('dev', event);
});

it('registers the hand-over as an exit hook when loaded', async () => {
  vi.resetModules();
  const once = vi.spyOn(process, 'once');

  await import('./telemetry.ts');

  expect(once).toHaveBeenCalledWith('exit', expect.any(Function));
  once.mockRestore();
});

it('hands over after 5 seconds in a process that keeps running', async () => {
  vi.useFakeTimers();
  await sendTelemetry({ eventType: 'dev', payload: {} });

  vi.advanceTimersByTime(4_999);
  expect(spawn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(1);
  expect(spawn).toHaveBeenCalledTimes(1);

  await sendTelemetry({ eventType: 'build', payload: {} });
  vi.advanceTimersByTime(5_000);
  expect(spawn).toHaveBeenCalledTimes(2);
});

it('starts no process when there is no event', () => {
  handOverPendingEvents();

  expect(handedOver()).toEqual([]);
  expect(spawn).not.toHaveBeenCalled();
});

it('writes the events to a file only its owner can read', async () => {
  await sendTelemetry({ eventType: 'dev', payload: {} });

  handOverPendingEvents();

  const [[file]] = handedOver();
  expect(vol.statSync(file).mode & 0o777).toBe(0o600);
  expect(vi.mocked(fs.writeFileSync).mock.calls[0][2]).toMatchObject({ flag: 'wx' });
});

it('starts the detached process without the debugger flags of this one', async () => {
  vi.stubEnv('NODE_OPTIONS', '--inspect-brk=0 --max-old-space-size=4096 --inspect');
  await sendTelemetry({ eventType: 'dev', payload: {} });

  handOverPendingEvents();

  const [, , options] = vi.mocked(spawn).mock.calls[0];
  expect(options.env?.NODE_OPTIONS?.trim()).toBe('--max-old-space-size=4096');
});

it('removes the file again when the detached process cannot be started', async () => {
  const child = childProcess(undefined);
  vi.mocked(spawn).mockImplementationOnce(() => child as any);
  await sendTelemetry({ eventType: 'dev', payload: {} });

  handOverPendingEvents();

  expect(handedOver()).toEqual([]);
  expect(() => child.emit('error', new Error('spawn ENOENT'))).not.toThrow();
});

it('removes the file again when starting the detached process throws', async () => {
  vi.mocked(spawn).mockImplementationOnce(() => {
    throw new Error('spawn EPERM');
  });
  await sendTelemetry({ eventType: 'dev', payload: {} });

  expect(() => handOverPendingEvents()).not.toThrow();

  expect(handedOver()).toEqual([]);
});

it('still resolves when the session id cannot be read', async () => {
  vi.mocked(getSessionId).mockRejectedValueOnce(new Error('disk'));

  await expect(sendTelemetry({ eventType: 'dev', payload: {} })).resolves.toBeUndefined();

  handOverPendingEvents();
  expect(spawn).not.toHaveBeenCalled();
});
