import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { importMetaResolve } from '../shared/utils/module.ts';
import { set as saveToCache } from './event-cache.ts';
import { getSessionId } from './session-id.ts';
import { handOverPendingEvents, sendTelemetry } from './telemetry.ts';

vi.mock('./event-cache.ts', { spy: true });
vi.mock('./session-id.ts', { spy: true });
vi.mock('node:child_process', { spy: true });
// The package export points at the compiled entry, which a unit test run does not have.
vi.mock('../shared/utils/module.ts', { spy: true });

let endpoint: Server;
let received: Promise<unknown>;

beforeEach(async () => {
  vi.mocked(saveToCache).mockImplementation(async () => {});
  vi.mocked(getSessionId).mockImplementation(async () => 'session-id');
  vi.mocked(importMetaResolve).mockReturnValue(
    new URL('./detached-flush.ts', import.meta.url).href
  );

  const { promise, resolve } = Promise.withResolvers<unknown>();
  received = promise;
  endpoint = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      response.end();
      resolve(JSON.parse(body));
    });
  }).listen(0, '127.0.0.1');
  await once(endpoint, 'listening');
  const { port } = endpoint.address() as AddressInfo;
  vi.stubEnv('STORYBOOK_TELEMETRY_URL', `http://127.0.0.1:${port}/event-log`);
});

afterEach(() => {
  endpoint.close();
});

it('delivers a handed-over event from a separate process and leaves no file behind', async () => {
  await sendTelemetry({ eventType: 'dev', payload: { foo: 'bar' } });

  handOverPendingEvents();

  const [, [, file]] = vi.mocked(spawn).mock.calls[0];
  const child: ChildProcess = vi.mocked(spawn).mock.results[0].value;
  const exited = once(child, 'exit');

  expect(await received).toMatchObject({
    eventType: 'dev',
    payload: { foo: 'bar' },
    sessionId: 'session-id',
    eventId: expect.any(String),
  });
  expect(await exited).toEqual([0, null]);
  expect(existsSync(file)).toBe(false);
});
