import { once } from 'node:events';
import { createServer, request, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { claudeCode } from '@ai-hero/sandcastle';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  credentialFor,
  PLACEHOLDER_KEY,
  proxyTheKey,
  sandboxAddresses,
  startKeyProxy,
} from './key-proxy.ts';
import { redactSecrets } from './redact.ts';

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
    callerAddress: caller,
    upstreamOrigin: origin,
    apiKey: REAL_KEY,
    log: (line) => log.push(line),
  });
  closers.push(() => proxy.server.close());
  return { url: proxy.baseUrl, log };
};

const send = (url: string, method = 'POST', requestTarget?: string) => {
  const { hostname, port, pathname, search } = new URL(url);
  const req = request({
    hostname,
    port,
    path: requestTarget ?? `${pathname}${search}`,
    method,
    headers: { 'x-api-key': PLACEHOLDER_KEY, 'content-type': 'application/json' },
  });
  req.end('{"model":"claude"}');
  return req;
};

const answerOf = async (url: string, method?: string, requestTarget?: string) => {
  const [res] = (await once(send(url, method, requestTarget), 'response')) as [IncomingMessage];
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

  it('drops the authorization header of the caller', async () => {
    const provider = await standIn((req, res) => {
      req.resume();
      res.end();
    });
    const { url } = await proxyTo(provider.origin);

    const req = request(`${url}/v1/messages`, {
      method: 'POST',
      headers: { authorization: 'Bearer caller-token', 'x-api-key': PLACEHOLDER_KEY },
    });
    req.end();
    await once(req, 'response');
    expect(provider.seen[0]!.headers).toMatchObject({ 'x-api-key': REAL_KEY });
    expect(provider.seen[0]!.headers).not.toHaveProperty('authorization');
  });

  it('answers 502 when the provider cannot be reached', async () => {
    const gone = createServer().listen(0, '127.0.0.1');
    await once(gone, 'listening');
    const { port } = gone.address() as AddressInfo;
    gone.close();
    const { url, log } = await proxyTo(`http://127.0.0.1:${port}`);

    expect(await answerOf(`${url}/v1/messages`)).toEqual({ status: 502, body: '' });
    expect(log).toEqual(['Key proxy: POST /v1/messages 502']);
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

  it('logs a caller that goes away before the answer as such, not as a provider failure', async () => {
    const provider = await standIn((req) => req.resume());
    const { url, log } = await proxyTo(provider.origin);

    const caller = request(`${url}/v1/messages`, { method: 'POST' });
    caller.on('error', () => {});
    caller.write('{"model":');
    await vi.waitFor(() => expect(provider.seen).toHaveLength(1));
    caller.destroy();

    await vi.waitFor(() =>
      expect(log).toEqual(['Key proxy: POST /v1/messages closed by the caller'])
    );
  });

  it('breaks off the answer to the caller when the provider breaks off its own', async () => {
    const provider = await standIn((req, res) => {
      req.resume();
      res.writeHead(200);
      res.write('partial');
      setTimeout(() => res.socket!.destroy(), 20);
    });
    const { url } = await proxyTo(provider.origin);

    const [res] = (await once(send(`${url}/v1/messages`), 'response')) as [IncomingMessage];
    res.resume();
    await expect(once(res, 'end')).rejects.toThrow('aborted');
  });
});

describe('startKeyProxy against a hostile caller', () => {
  it.each([
    ['an absolute-form target', (port: number) => `http://127.0.0.1:${port}/v1/messages`],
    ['a target that starts with two slashes', (port: number) => `//127.0.0.1:${port}/v1/messages`],
  ])('never sends the key to a host named in %s', async (_name, target) => {
    const provider = await standIn((req, res) => {
      req.resume();
      res.end();
    });
    const elsewhere = await standIn((req, res) => {
      req.resume();
      res.end();
    });
    const { url } = await proxyTo(provider.origin);

    const { status } = await answerOf(url, 'POST', target(Number(new URL(elsewhere.origin).port)));

    expect(status).toBe(404);
    expect(elsewhere.seen).toHaveLength(0);
  });

  it('answers 404 to a target that is no URL, and keeps serving', async () => {
    const provider = await standIn((req, res) => {
      req.resume();
      res.end();
    });
    const { url } = await proxyTo(provider.origin);

    expect((await answerOf(url, 'POST', 'http://[')).status).toBe(404);
    expect((await answerOf(`${url}/v1/messages`)).status).toBe(200);
  });
});

describe('credentialFor', () => {
  const proxyPath = { engine: 'claude', os: 'linux', sandbox: 'docker' } as const;

  it('takes the key out of the environment on the proxy path, as it reads it', () => {
    const env = { ANTHROPIC_API_KEY: REAL_KEY, PATH: '/usr/bin' };

    expect(credentialFor(proxyPath, env)).toEqual({
      name: 'ANTHROPIC_API_KEY',
      value: REAL_KEY,
      proxied: true,
    });
    expect(env).toEqual({ PATH: '/usr/bin' });
  });

  it.each([
    ['macOS', { ...proxyPath, os: 'macos' }, 'ANTHROPIC_API_KEY'],
    ['bwrap', { ...proxyPath, sandbox: 'bwrap' }, 'ANTHROPIC_API_KEY'],
    ['the subscription token', proxyPath, 'CLAUDE_CODE_OAUTH_TOKEN'],
    ['Codex', { ...proxyPath, engine: 'codex' }, 'CODEX_API_KEY'],
  ] as const)(
    'leaves the key in the environment for %s, which runs without the proxy',
    (_, request, name) => {
      const env = { [name]: REAL_KEY };

      expect(credentialFor(request, env)).toEqual({ name, value: REAL_KEY, proxied: false });
      expect(env).toEqual({ [name]: REAL_KEY });
    }
  );

  it('names the variables it looked for when none is set', () => {
    expect(credentialFor(proxyPath, { CODEX_API_KEY: REAL_KEY })).toBe(
      'None of ANTHROPIC_API_KEY, CLAUDE_CODE_OAUTH_TOKEN is set.'
    );
  });
});

describe('proxyTheKey', () => {
  const proxied = async (upstreamOrigin: string, host = '127.0.0.1') => {
    const proxy = await proxyTheKey(REAL_KEY, {
      host,
      callerAddress: '127.0.0.1',
      upstreamOrigin,
      log: () => {},
    });
    closers.push(proxy.close);
    return proxy;
  };

  it('hands the agent the proxy and a placeholder, and sends the real key to the provider', async () => {
    const provider = await standIn((req, res) => {
      req.resume();
      res.end();
    });

    const { agentEnv } = await proxied(provider.origin);

    expect(agentEnv).toEqual({
      ANTHROPIC_BASE_URL: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+$/),
      ANTHROPIC_API_KEY: PLACEHOLDER_KEY,
    });
    expect((await answerOf(`${agentEnv.ANTHROPIC_BASE_URL}/v1/messages`)).status).toBe(200);
    expect(provider.seen[0]!.headers['x-api-key']).toBe(REAL_KEY);
  });

  it('stops answering once closed', async () => {
    const provider = await standIn((req, res) => {
      req.resume();
      res.end();
    });
    const proxy = await proxied(provider.origin);
    await answerOf(`${proxy.agentEnv.ANTHROPIC_BASE_URL}/v1/messages`);

    proxy.close();

    await expect(answerOf(`${proxy.agentEnv.ANTHROPIC_BASE_URL}/v1/messages`)).rejects.toThrow();
  });

  it('finds the key in the variables Sandcastle exports for the agent, where it went before the proxy', async () => {
    const proxy = await proxied('http://127.0.0.1:9');
    const clean = 'HOME=/home/agent\nCI=false\n';

    expect(proxy.reaches(clean, claudeCode('m', { env: { ANTHROPIC_API_KEY: REAL_KEY } }))).toBe(
      true
    );
    expect(proxy.reaches(`ANTHROPIC_API_KEY=${REAL_KEY}\n`, claudeCode('m', {}))).toBe(true);
    expect(proxy.reaches(clean, claudeCode('m', { env: proxy.agentEnv }))).toBe(false);
  });

  it('names a Docker daemon in a VM when the gateway is not an address of this machine', async () => {
    await expect(proxied('http://127.0.0.1:9', '192.0.2.1')).rejects.toThrow(
      'The Docker daemon runs in a VM'
    );
  });
});

describe('PLACEHOLDER_KEY', () => {
  it('survives the redaction of the run record, so a leak search finds only the real key', () => {
    expect(redactSecrets(`ANTHROPIC_API_KEY=${PLACEHOLDER_KEY}`)).toContain(PLACEHOLDER_KEY);
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
