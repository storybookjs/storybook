import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';

import { join } from 'pathe';

import { set as saveToCache } from './event-cache.ts';
import { createFlushEventsScript, flushEventsScript } from './flush-events-script.ts';
import { getSessionId } from './session-id.ts';
import { handOverPendingEvents, sendTelemetry } from './telemetry.ts';

vi.mock('./event-cache.ts', { spy: true });
vi.mock('./session-id.ts', { spy: true });
vi.mock('node:child_process', { spy: true });

type Respond = (attempt: number, request: IncomingMessage, response: ServerResponse) => void;

let endpoint: Server;
let directory: string;
let requests: { contentType: string | undefined; body: unknown }[];
let respond: Respond;

// The script runs in a real process, which sees the real file system and not memfs.
beforeEach(async () => {
  vi.mocked(saveToCache).mockImplementation(async () => {});
  vi.mocked(getSessionId).mockImplementation(() => 'session-id');
  directory = mkdtempSync(join(tmpdir(), 'storybook-telemetry-test-'));
  requests = [];
  respond = (_attempt, _request, response) => response.end('ok');

  endpoint = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      requests.push({ contentType: request.headers['content-type'], body: JSON.parse(body) });
      respond(requests.length, request, response);
    });
  }).listen(0, '127.0.0.1');
  await once(endpoint, 'listening');
  const { port } = endpoint.address() as AddressInfo;
  vi.stubEnv('STORYBOOK_TELEMETRY_URL', `http://127.0.0.1:${port}/event-log`);
});

afterEach(() => {
  vi.unstubAllEnvs();
  endpoint.closeAllConnections();
  endpoint.close();
  rmSync(directory, { recursive: true, force: true });
});

// The real delays are 1, 2 and 4 seconds, and the real deadline is 30 seconds.
const flush = async (contents: string, { deadline = 30_000, retryDelay = 5 } = {}) => {
  const file = join(directory, 'events.json');
  writeFileSync(file, contents);
  const script = createFlushEventsScript({ deadline, retryDelay });
  const child = spawn(process.execPath, ['--eval', script, file], {
    env: { ...process.env, NODE_OPTIONS: '' },
    stdio: 'ignore',
  });
  const [exitCode] = await once(child, 'exit');
  return { exitCode, file };
};

it('delivers the events that telemetry hands over, and leaves no file behind', async () => {
  await sendTelemetry({ eventType: 'dev', payload: { foo: 'bar' } });

  handOverPendingEvents();

  const file = vi.mocked(spawn).mock.calls[0][1].at(-1) as string;
  const child: ChildProcess = vi.mocked(spawn).mock.results[0].value;
  expect(await once(child, 'exit')).toEqual([0, null]);
  expect(requests).toEqual([
    {
      contentType: 'application/json',
      body: expect.objectContaining({
        eventType: 'dev',
        payload: { foo: 'bar' },
        sessionId: 'session-id',
        eventId: expect.any(String),
      }),
    },
  ]);
  expect(existsSync(file)).toBe(false);
});

it('posts one event at a time, in the order they occurred', async () => {
  const events = [{ eventId: 'a' }, { eventId: 'b' }, { eventId: 'c' }];
  let unanswered = 0;
  let overlapped = false;
  respond = (_attempt, _request, response) => {
    overlapped ||= unanswered > 0;
    unanswered += 1;
    setTimeout(() => {
      unanswered -= 1;
      response.end();
    }, 50);
  };

  const { exitCode } = await flush(JSON.stringify(events));

  expect(exitCode).toBe(0);
  expect(requests.map(({ body }) => body)).toEqual(events);
  expect(overlapped).toBe(false);
});

it.each([503, 504])('retries a %i response', async (status) => {
  respond = (attempt, _request, response) => {
    response.statusCode = attempt === 1 ? status : 200;
    response.end();
  };

  await flush(JSON.stringify([{ eventId: 'a' }]));

  expect(requests.map(({ body }) => body)).toEqual([{ eventId: 'a' }, { eventId: 'a' }]);
});

it('retries when the connection fails', async () => {
  respond = (attempt, request, response) =>
    attempt === 1 ? request.socket.destroy() : response.end();

  await flush(JSON.stringify([{ eventId: 'a' }]));

  expect(requests).toHaveLength(2);
});

it('stops after three retries', async () => {
  respond = (_attempt, _request, response) => {
    response.statusCode = 503;
    response.end();
  };

  const { exitCode } = await flush(JSON.stringify([{ eventId: 'a' }]));

  expect(exitCode).toBe(0);
  expect(requests).toHaveLength(4);
});

it('gives up on every event at its deadline when the endpoint does not answer', async () => {
  respond = () => {};

  const { exitCode } = await flush(JSON.stringify([{ eventId: 'a' }, { eventId: 'b' }]), {
    deadline: 300,
  });

  expect(exitCode).toBe(0);
  expect(requests.map(({ body }) => body)).toEqual([{ eventId: 'a' }]);
});

it('waits 30 seconds at most, and 1 second before the first retry', () => {
  expect(flushEventsScript).toContain('AbortSignal.timeout(30000)');
  expect(flushEventsScript).toContain('2 ** attempt * 1000');
});

it('does not retry any other response', async () => {
  respond = (_attempt, _request, response) => {
    response.statusCode = 500;
    response.end();
  };

  await flush(JSON.stringify([{ eventId: 'a' }, { eventId: 'b' }]));

  expect(requests.map(({ body }) => body)).toEqual([{ eventId: 'a' }, { eventId: 'b' }]);
});

it('removes a file it cannot parse', async () => {
  const { exitCode, file } = await flush('[{"eventId":');

  expect(exitCode).not.toBe(0);
  expect(existsSync(file)).toBe(false);
  expect(requests).toEqual([]);
});
