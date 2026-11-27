import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { type Server, type ServerResponse, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

import { importMetaResolve } from '../shared/utils/module.ts';
import { set as saveToCache } from './event-cache.ts';
import { getSessionId } from './session-id.ts';
import { sendTelemetry } from './telemetry.ts';

vi.mock('./event-cache.ts', { spy: true });
vi.mock('./session-id.ts', { spy: true });
vi.mock('node:child_process', { spy: true });
// The package export points at the compiled entry, which a unit test run does not have.
vi.mock('../shared/utils/module.ts', { spy: true });

let endpoint: Server;
let requests: unknown[];
let respond: (response: ServerResponse) => void;
let received: Promise<void>;

beforeEach(async () => {
  vi.mocked(saveToCache).mockImplementation(async () => {});
  vi.mocked(getSessionId).mockImplementation(() => 'session-id');
  vi.mocked(importMetaResolve).mockReturnValue(new URL('./sender.ts', import.meta.url).href);
  requests = [];
  respond = (response) => response.end();

  const { promise, resolve } = Promise.withResolvers<void>();
  received = promise;
  endpoint = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      requests.push(JSON.parse(body));
      resolve();
      respond(response);
    });
  }).listen(0, '127.0.0.1');
  await once(endpoint, 'listening');
  const { port } = endpoint.address() as AddressInfo;
  vi.stubEnv('STORYBOOK_TELEMETRY_URL', `http://127.0.0.1:${port}/event-log`);
});

afterEach(async () => {
  for (const { value: sender } of vi.mocked(spawn).mock.results) {
    if (sender?.connected) {
      sender.disconnect();
    }
  }
  vi.unstubAllEnvs();
  endpoint.closeAllConnections();
  await new Promise((resolve) => endpoint.close(resolve));
});

const startedSender = (): ChildProcess => vi.mocked(spawn).mock.results.at(-1)?.value;

it('posts an event from a separate process, which exits when this process lets go of it', async () => {
  await sendTelemetry({ eventType: 'dev', payload: { foo: 'bar' } });
  const sender = startedSender();
  const exited = once(sender, 'exit');

  await received;
  sender.disconnect();

  expect(await exited).toEqual([0, null]);
  expect(requests).toEqual([
    expect.objectContaining({
      eventType: 'dev',
      payload: { foo: 'bar' },
      sessionId: 'session-id',
      eventId: expect.any(String),
    }),
  ]);
});

it('still posts an event when this process lets go right after sending it', async () => {
  respond = (response) => setTimeout(() => response.end(), 200);
  await sendTelemetry({ eventType: 'build', payload: {} });
  const sender = startedSender();
  const exited = once(sender, 'exit');

  sender.disconnect();

  expect(await exited).toEqual([0, null]);
  expect(requests).toEqual([expect.objectContaining({ eventType: 'build' })]);
});

it('still posts an event when the process that sent it exits as soon as the event is written', async () => {
  const script = fileURLToPath(new URL('./sender.ts', import.meta.url));
  // What handOver and startSender do, in a process that really exits.
  const command = `
    const sender = require('node:child_process').spawn(process.execPath, [${JSON.stringify(script)}], {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      windowsHide: true,
    });
    sender.send({ eventType: 'build' }, () => process.exit());
  `;

  const [exitCode] = await once(spawn(process.execPath, ['--eval', command]), 'exit');
  await received;

  expect(exitCode).toBe(0);
  expect(requests).toEqual([{ eventType: 'build' }]);
});

it('still posts an event when the temp directory does not exist', async () => {
  for (const name of ['TMPDIR', 'TEMP', 'TMP']) {
    vi.stubEnv(name, fileURLToPath(new URL('./does-not-exist', import.meta.url)));
  }

  await sendTelemetry({ eventType: 'dev', payload: {} });
  await received;

  expect(requests).toEqual([expect.objectContaining({ eventType: 'dev' })]);
});
