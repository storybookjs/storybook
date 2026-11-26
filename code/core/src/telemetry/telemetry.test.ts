import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';

import * as memfs from 'memfs';
import { vol } from 'memfs';
import { dirname } from 'pathe';

import { set as saveToCache } from './event-cache.ts';
import { flushEventsScript } from './flush-events-script.ts';
import { getSessionId } from './session-id.ts';
import { handOverPendingEvents, sendTelemetry } from './telemetry.ts';

vi.mock('./event-cache.ts', { spy: true });
vi.mock('./session-id.ts', { spy: true });
vi.mock('node:fs', { spy: true });
vi.mock('node:child_process', { spy: true });

const childProcess = (pid: number | undefined) =>
  Object.assign(new EventEmitter(), { pid, unref: vi.fn() });

beforeEach(() => {
  vol.reset();
  vol.mkdirSync(os.tmpdir(), { recursive: true });
  vi.mocked(fs.writeFileSync).mockImplementation(memfs.fs.writeFileSync as any);
  vi.mocked(fs.rmSync).mockImplementation(memfs.fs.rmSync as any);
  vi.mocked(saveToCache).mockImplementation(async () => {});
  vi.mocked(getSessionId).mockImplementation(() => 'session-id');
  vi.mocked(spawn).mockImplementation(() => childProcess(1) as any);
});

afterEach(() => {
  handOverPendingEvents();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const handedOverFile = (call = 0) => vi.mocked(spawn).mock.calls[call][1].at(-1) as string;
const handedOverEvents = (call = 0) =>
  JSON.parse(vol.readFileSync(handedOverFile(call), 'utf8') as string);
const filesLeft = () => Object.values(vol.toJSON()).filter((contents) => contents !== null);

it('hands the events to one detached process, with their data and context', async () => {
  await sendTelemetry({ eventType: 'dev', payload: { foo: 'bar' } });
  await sendTelemetry({ eventType: 'build', payload: {} });

  handOverPendingEvents();
  handOverPendingEvents();

  expect(spawn).toHaveBeenCalledTimes(1);
  expect(handedOverEvents()).toEqual([
    expect.objectContaining({
      eventType: 'dev',
      payload: { foo: 'bar' },
      sessionId: 'session-id',
      eventId: expect.any(String),
      context: expect.objectContaining({ storybookVersion: expect.any(String) }),
    }),
    expect.objectContaining({ eventType: 'build' }),
  ]);
  expect(handedOverFile()).toMatch(/storybook-telemetry-.*\.json$/);

  const [command, args, options] = vi.mocked(spawn).mock.calls[0];
  expect(command).toBe(process.execPath);
  expect(args).toEqual(['--eval', flushEventsScript, handedOverFile()]);
  expect(options).toMatchObject({ detached: true, stdio: 'ignore', windowsHide: true });
  expect(vi.mocked(spawn).mock.results[0].value.unref).toHaveBeenCalled();
});

it('queues an event before its first await, so an exit right after the call does not lose it', () => {
  void sendTelemetry({ eventType: 'dev', payload: {} });

  handOverPendingEvents();

  expect(handedOverEvents()).toEqual([expect.objectContaining({ eventType: 'dev' })]);
});

it('saves the event it hands over to the local event cache', async () => {
  await sendTelemetry({ eventType: 'dev', payload: {} });
  handOverPendingEvents();

  expect(saveToCache).toHaveBeenCalledWith('dev', handedOverEvents()[0]);
});

it('hands over when the process exits', async () => {
  vi.resetModules();
  const once = vi.spyOn(process, 'once');
  const telemetry = await import('./telemetry.ts');
  const [, onExit] = once.mock.calls.find(([event]) => event === 'exit')!;
  once.mockRestore();
  await telemetry.sendTelemetry({ eventType: 'dev', payload: {} });

  onExit(0);

  expect(handedOverEvents()).toEqual([expect.objectContaining({ eventType: 'dev' })]);
});

it('hands over after 5 seconds in a process that keeps running', async () => {
  vi.useFakeTimers();
  await sendTelemetry({ eventType: 'dev', payload: {} });

  vi.advanceTimersByTime(4_999);
  expect(spawn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(1);
  expect(handedOverEvents()).toEqual([expect.objectContaining({ eventType: 'dev' })]);

  await sendTelemetry({ eventType: 'build', payload: {} });
  vi.advanceTimersByTime(5_000);
  expect(handedOverEvents(1)).toEqual([expect.objectContaining({ eventType: 'build' })]);
});

it('starts no process when there is no event', () => {
  handOverPendingEvents();

  expect(filesLeft()).toEqual([]);
  expect(spawn).not.toHaveBeenCalled();
});

it('writes the events to a file only its owner can read', async () => {
  await sendTelemetry({ eventType: 'dev', payload: {} });

  handOverPendingEvents();

  expect(vol.statSync(handedOverFile()).mode & 0o777).toBe(0o600);
  expect(vi.mocked(fs.writeFileSync).mock.calls[0][2]).toMatchObject({ flag: 'wx' });
});

it('starts the detached process next to its runtime and without the Node options of this one', async () => {
  vi.stubEnv('NODE_OPTIONS', '--require ./.pnp.cjs --inspect-brk');
  vi.stubEnv('STORYBOOK_TELEMETRY_URL', 'http://localhost:6007/event-log');
  await sendTelemetry({ eventType: 'dev', payload: {} });

  handOverPendingEvents();

  const [, , options] = vi.mocked(spawn).mock.calls[0];
  expect(options.cwd).toBe(dirname(process.execPath));
  expect(options.env).toMatchObject({
    NODE_OPTIONS: '',
    STORYBOOK_TELEMETRY_URL: 'http://localhost:6007/event-log',
  });
});

it('removes the file again when the detached process cannot be started', async () => {
  const child = childProcess(undefined);
  vi.mocked(spawn).mockImplementationOnce(() => child as any);
  await sendTelemetry({ eventType: 'dev', payload: {} });

  handOverPendingEvents();

  expect(filesLeft()).toEqual([]);
  expect(() => child.emit('error', new Error('spawn ENOENT'))).not.toThrow();
});

it('removes the file again when starting the detached process throws', async () => {
  vi.mocked(spawn).mockImplementationOnce(() => {
    throw new Error('spawn EPERM');
  });
  await sendTelemetry({ eventType: 'dev', payload: {} });

  expect(() => handOverPendingEvents()).not.toThrow();

  expect(filesLeft()).toEqual([]);
});

it('still resolves when the session id cannot be read', async () => {
  vi.mocked(getSessionId).mockImplementationOnce(() => {
    throw new Error('disk');
  });

  await expect(sendTelemetry({ eventType: 'dev', payload: {} })).resolves.toBeUndefined();

  handOverPendingEvents();
  expect(spawn).not.toHaveBeenCalled();
});
