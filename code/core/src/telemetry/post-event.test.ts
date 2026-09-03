import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';

import { type Server, createServer } from 'node:http';
import { Socket } from 'node:net';

import type { postEvent as PostEvent } from './post-event.ts';

let server: Server;
let postEvent: typeof PostEvent;
let responses: Array<number | 'hang'> = [];
let received = 0;

beforeAll(async () => {
  server = createServer((request, response) => {
    received += 1;
    request.resume();
    const next = responses.shift() ?? 200;
    if (next === 'hang') {
      return;
    }
    request.on('end', () => {
      response.writeHead(next);
      response.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  vi.stubEnv('STORYBOOK_TELEMETRY_URL', `http://127.0.0.1:${port}/event-log`);
  ({ postEvent } = await import('./post-event.ts'));
});

afterAll(() => {
  vi.unstubAllEnvs();
  server.closeAllConnections();
  server.close();
});

afterEach(() => {
  responses = [];
  received = 0;
  vi.restoreAllMocks();
});

const event = { body: { eventType: 'dev', eventId: 'e1' } as any, retryDelay: 0 };

it('posts the event once when the server accepts it', async () => {
  await postEvent(event, { signal: AbortSignal.timeout(1000), keepProcessAlive: true });

  expect(received).toBe(1);
});

it('retries a 503 response', async () => {
  responses = [503, 200];

  await postEvent(event, { signal: AbortSignal.timeout(1000), keepProcessAlive: true });

  expect(received).toBe(2);
});

it('gives up after three retries', async () => {
  responses = [503, 503, 503, 503, 503];

  await postEvent(event, { signal: AbortSignal.timeout(1000), keepProcessAlive: true });

  expect(received).toBe(4);
});

it('abandons a request that never responds once the signal aborts', async () => {
  responses = ['hang'];

  await expect(
    postEvent(event, { signal: AbortSignal.timeout(50), keepProcessAlive: true })
  ).rejects.toThrow();
  expect(received).toBe(1);
});

it('unrefs the socket while the request is in flight, unless it may keep the process alive', async () => {
  const unref = vi.spyOn(Socket.prototype, 'unref');
  const inFlight = async (keepProcessAlive: boolean) => {
    responses = ['hang'];
    const controller = new AbortController();
    const request = postEvent(event, { signal: controller.signal, keepProcessAlive });
    await vi.waitFor(() => expect(received).toBe(1));
    const unrefCalls = unref.mock.calls.length;
    controller.abort();
    await request.catch(() => {});
    received = 0;
    unref.mockClear();
    return unrefCalls;
  };

  expect(await inFlight(false)).toBeGreaterThan(0);
  expect(await inFlight(true)).toBe(0);
});
