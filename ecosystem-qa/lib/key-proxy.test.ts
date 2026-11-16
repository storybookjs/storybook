import { once } from 'node:events';
import { createServer, request, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { PLACEHOLDER_KEY, sandboxAddresses, startKeyProxy } from './key-proxy.ts';

const REAL_KEY = 'sk-ant-real-key-0123456789';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

const closers: (() => void)[] = [];

afterEach(() => {
  closers.splice(0).forEach((close) => close());
});

const standIn = async (handle: Handler) => {
  const seen: IncomingMessage[] = [];
  const server = createServer((req, res) => {
    seen.push(req);
    handle(req, res);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  closers.push(() => server.close());
  return { seen, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
};

const proxyTo = async (origin: string, caller = '127.0.0.1') => {
  const log: string[] = [];
  const proxy = await startKeyProxy({
    host: '127.0.0.1',
    caller,
    upstream: origin,
    apiKey: REAL_KEY,
    log: (line) => log.push(line),
  });
  closers.push(() => proxy.server.close());
  return { url: proxy.url, log };
};

const send = (url: string, method = 'POST') => {
  const req = request(url, {
    method,
    headers: { 'x-api-key': PLACEHOLDER_KEY, 'content-type': 'application/json' },
  });
  req.end('{"model":"claude"}');
  return req;
};

const answerOf = async (url: string, method?: string) => {
  const [res] = (await once(send(url, method), 'response')) as [IncomingMessage];
  let body = '';
  for await (const chunk of res) {
    body += chunk;
  }
  return { status: res.statusCode, body };
};

describe('startKeyProxy', () => {
  it('forwards a message request with the real key in place of the placeholder', async () => {
    const provider = await standIn((req, res) => {
      req.resume();
      res.end('ok');
    });
    const { url, log } = await proxyTo(provider.origin);

    expect(await answerOf(`${url}/v1/messages?beta=true`)).toEqual({ status: 200, body: 'ok' });
    expect(provider.seen.map((req) => [req.url, req.headers['x-api-key']])).toEqual([
      ['/v1/messages?beta=true', REAL_KEY],
    ]);
    expect(log).toEqual(['Key proxy: POST /v1/messages 200']);
  });

  it('forwards a token count too', async () => {
    const provider = await standIn((req, res) => {
      req.resume();
      res.end('{"input_tokens":3}');
    });
    const { url } = await proxyTo(provider.origin);

    expect((await answerOf(`${url}/v1/messages/count_tokens`)).status).toBe(200);
    expect(provider.seen).toHaveLength(1);
  });

  it.each([
    ['POST', '/v1/files'],
    ['GET', '/v1/messages'],
    ['POST', '/v1/messages/batches'],
  ])('answers 404 to %s %s without asking the provider', async (method, path) => {
    const provider = await standIn((_req, res) => res.end());
    const { url, log } = await proxyTo(provider.origin);

    expect((await answerOf(`${url}${path}`, method)).status).toBe(404);
    expect(provider.seen).toHaveLength(0);
    expect(log).toEqual([`Key proxy: ${method} ${path} 404`]);
  });

  it('refuses a caller that is not the sandbox', async () => {
    const provider = await standIn((_req, res) => res.end());
    const { url } = await proxyTo(provider.origin, '172.17.0.9');

    expect((await answerOf(`${url}/v1/messages`)).status).toBe(403);
    expect(provider.seen).toHaveLength(0);
  });

  it('hands on the first part of an answer before the provider has ended it', async () => {
    let finish = () => {};
    const provider = await standIn((req, res) => {
      req.resume();
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('event: message_start\n\n');
      finish = () => res.end('event: message_stop\n\n');
    });
    const { url } = await proxyTo(provider.origin);

    const [res] = (await once(send(`${url}/v1/messages`), 'response')) as [IncomingMessage];
    const [first] = (await once(res, 'data')) as [Buffer];
    expect(first.toString()).toBe('event: message_start\n\n');
    finish();
    await once(res, 'end');
  });

  it('ends the request at the provider when the caller goes away', async () => {
    const provider = await standIn((req, res) => {
      req.resume();
      res.writeHead(200);
      res.write('partial');
    });
    const { url } = await proxyTo(provider.origin);

    const caller = send(`${url}/v1/messages`);
    const [res] = (await once(caller, 'response')) as [IncomingMessage];
    await once(res, 'data');
    const closed = once(provider.seen[0]!.socket, 'close');
    caller.destroy();
    await closed;
  });
});

describe('sandboxAddresses', () => {
  it('reads the gateway and the address of a container on the default bridge', () => {
    const inspect = JSON.stringify([
      {
        NetworkSettings: {
          Networks: {
            bridge: { Gateway: '172.17.0.1', IPAddress: '172.17.0.2', MacAddress: '' },
          },
        },
      },
    ]);
    expect(sandboxAddresses(inspect)).toEqual({ gateway: '172.17.0.1', container: '172.17.0.2' });
  });

  it('refuses a container on more than one network', () => {
    const network = { Gateway: '172.17.0.1', IPAddress: '172.17.0.2' };
    const inspect = JSON.stringify([
      { NetworkSettings: { Networks: { bridge: network, other: network } } },
    ]);
    expect(() => sandboxAddresses(inspect)).toThrow('The sandbox has 2 networks');
  });
});
