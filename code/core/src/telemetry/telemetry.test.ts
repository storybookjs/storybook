import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { set as saveToCache } from './event-cache.ts';
import { getSessionId } from './session-id.ts';
import { sendTelemetry } from './telemetry.ts';

vi.mock('./event-cache.ts', { spy: true });
vi.mock('./session-id.ts', { spy: true });
vi.mock('node:child_process', { spy: true });

const createSender = () =>
  Object.assign(new EventEmitter(), {
    connected: true,
    send: vi.fn((_event: unknown, written: () => void) => written()),
    unref: vi.fn(),
    channel: { unref: vi.fn() } as { unref: () => void } | undefined,
  });

let sender: ReturnType<typeof createSender>;

beforeEach(() => {
  sender = createSender();
  vi.mocked(saveToCache).mockImplementation(async () => {});
  vi.mocked(getSessionId).mockImplementation(() => 'session-id');
  vi.mocked(spawn).mockImplementation(() => sender as any);
});

afterEach(() => {
  sender.connected = false;
  vi.unstubAllEnvs();
});

const sentEvents = () => sender.send.mock.calls.map(([event]) => event);

it('sends every event to one detached process, with its data and context', async () => {
  await sendTelemetry({ eventType: 'dev', payload: { foo: 'bar' } });
  await sendTelemetry({ eventType: 'build', payload: {} });

  expect(sentEvents()).toEqual([
    expect.objectContaining({
      eventType: 'dev',
      payload: { foo: 'bar' },
      sessionId: 'session-id',
      eventId: expect.any(String),
      context: expect.objectContaining({ storybookVersion: expect.any(String) }),
    }),
    expect.objectContaining({ eventType: 'build' }),
  ]);

  expect(spawn).toHaveBeenCalledTimes(1);
  const [command, args, options] = vi.mocked(spawn).mock.calls[0];
  expect(command).toBe(process.execPath);
  expect(args).toEqual([expect.stringMatching(/sender/)]);
  expect(options).toMatchObject({
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    windowsHide: true,
  });
});

it('starts sending an event before its first await', () => {
  void sendTelemetry({ eventType: 'dev', payload: {} });

  expect(sentEvents()).toEqual([expect.objectContaining({ eventType: 'dev' })]);
});

it('resolves only when the event is written to the process', async () => {
  let written = () => {};
  sender.send.mockImplementationOnce((_event, callback) => {
    written = callback;
  });
  let resolved = false;
  const sent = sendTelemetry({ eventType: 'dev', payload: {} }).then(() => {
    resolved = true;
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(resolved).toBe(false);

  written();
  await sent;
  expect(resolved).toBe(true);
});

it('still waits for the event to be written when the local event cache cannot be saved', async () => {
  vi.mocked(saveToCache).mockRejectedValue(new Error('EACCES'));
  let written = () => {};
  sender.send.mockImplementationOnce((_event, callback) => {
    written = callback;
  });
  let resolved = false;
  const sent = sendTelemetry({ eventType: 'dev', payload: {} }).then(() => {
    resolved = true;
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(resolved).toBe(false);

  written();
  await sent;
  expect(resolved).toBe(true);
});

it('resolves when the process exits before it has read the event', async () => {
  sender.send.mockImplementationOnce(() => {});
  const sent = sendTelemetry({ eventType: 'dev', payload: {} });

  sender.emit('exit', 1, null);

  await expect(sent).resolves.toBeUndefined();
});

it('stops listening for the exit of the process once the event is written', async () => {
  await sendTelemetry({ eventType: 'dev', payload: {} });

  expect(sender.listenerCount('exit')).toBe(0);
});

it('saves the event it sends to the local event cache', async () => {
  await sendTelemetry({ eventType: 'dev', payload: {} });

  expect(saveToCache).toHaveBeenCalledWith('dev', sentEvents()[0]);
});

it('lets neither the process nor its channel keep this process alive', async () => {
  await sendTelemetry({ eventType: 'dev', payload: {} });

  expect(sender.unref).toHaveBeenCalled();
  expect(sender.channel?.unref).toHaveBeenCalled();
});

it('starts the process on a runtime whose channel cannot be unreferenced', async () => {
  sender.channel = undefined;

  await sendTelemetry({ eventType: 'dev', payload: {} });

  expect(sentEvents()).toHaveLength(1);
});

it('starts a new process when the last one is gone', async () => {
  await sendTelemetry({ eventType: 'dev', payload: {} });
  sender.connected = false;
  const next = createSender();
  sender = next;

  await sendTelemetry({ eventType: 'build', payload: {} });

  expect(spawn).toHaveBeenCalledTimes(2);
  expect(next.send).toHaveBeenCalledWith(
    expect.objectContaining({ eventType: 'build' }),
    expect.any(Function)
  );
});

it('starts the process without the debugger flags of this one, and keeps its other options', async () => {
  vi.stubEnv(
    'NODE_OPTIONS',
    [
      '--inspect-brk=0',
      '"--inspect-brk=0"',
      '--require /my--inspect-app/.pnp.cjs',
      '--require "/my dir/--inspect app/preload.cjs"',
      '--use-openssl-ca',
      '--inspect',
    ].join(' ')
  );

  await sendTelemetry({ eventType: 'dev', payload: {} });

  const [, , options] = vi.mocked(spawn).mock.calls[0];
  expect(options.env?.NODE_OPTIONS?.trim()).toBe(
    '--require /my--inspect-app/.pnp.cjs --require "/my dir/--inspect app/preload.cjs" --use-openssl-ca'
  );
});

it('still resolves when the process cannot be started', async () => {
  vi.mocked(spawn).mockImplementationOnce(() => {
    throw new Error('spawn EPERM');
  });

  await expect(sendTelemetry({ eventType: 'dev', payload: {} })).resolves.toBeUndefined();
  expect(saveToCache).toHaveBeenCalledWith('dev', expect.objectContaining({ eventType: 'dev' }));
});

it('does not crash when the process fails after it was started', async () => {
  await sendTelemetry({ eventType: 'dev', payload: {} });

  expect(() => sender.emit('error', new Error('spawn ENOENT'))).not.toThrow();
});

it('still resolves when building the event throws', async () => {
  vi.mocked(getSessionId).mockImplementationOnce(() => {
    throw new Error('disk');
  });

  await expect(sendTelemetry({ eventType: 'dev', payload: {} })).resolves.toBeUndefined();
  expect(spawn).not.toHaveBeenCalled();
});
