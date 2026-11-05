import { describe, expect, it, vi } from 'vitest';

import { createServer, get, type Server } from 'node:http';
import { type AddressInfo, connect } from 'node:net';
import os from 'node:os';
import { once } from 'node:events';

import { WebSocket } from 'ws';

import { ServerChannelTransport } from './get-server-channel.ts';
import { getHostValidationMiddleware } from './getHostValidationMiddleware.ts';

import {
  getListenHost,
  getServerAddresses,
  getServerChannelUrl,
  getServerPort,
} from './server-address.ts';

const lanAddress = Object.values(os.networkInterfaces())
  .flat()
  .find((iface) => iface?.family === 'IPv4' && !iface.internal)?.address;

const listen = async (host: string, port = 0) => {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ port, host }, resolve);
  });
  return server;
};

const close = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const tryConnect = (host: string, port: number) =>
  new Promise<string>((resolve) => {
    const socket = connect({ host, port });
    socket.once('connect', () => {
      socket.destroy();
      resolve('connected');
    });
    socket.once('error', (error: NodeJS.ErrnoException) => resolve(error.code ?? 'error'));
  });

const isLoopback = (address: string) => address === '::1' || address.startsWith('127.');

const fetchBody = (host: string, port: number) =>
  new Promise<string>((resolve, reject) => {
    get({ host, port }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });

it('shares a port across IPv4 and IPv6 loopback with independent HTTP and server channels', async (context) => {
  let ipv6: Server;
  try {
    ipv6 = await listen('::1');
  } catch (error) {
    if (['EADDRNOTAVAIL', 'EAFNOSUPPORT'].includes((error as NodeJS.ErrnoException).code!)) {
      context.skip();
      return;
    }
    throw error;
  }
  await close(ipv6);

  const first = await listen('127.0.0.1');
  const { port } = first.address() as AddressInfo;
  const servers = [first];
  const transports: ServerChannelTransport[] = [];
  const clients: WebSocket[] = [];
  try {
    expect(await getServerPort(port, { host: '::1', exactPort: true })).toBe(port);
    const second = await listen(getListenHost('::1'), port);
    servers.push(second);
    for (const [server, host] of [
      [first, '127.0.0.1'],
      [second, '::1'],
    ] as const) {
      const { address: localAddress } = getServerAddresses(port, host, 'http');
      const options = { host, localAddress, token: 'listener-test-token' };
      const validate = getHostValidationMiddleware(options);
      server.on('request', (req, res) =>
        validate(req, res, () => {
          res.end(host);
        })
      );
      const transport = new ServerChannelTransport(server, options);
      transports.push(transport);
      expect(await fetchBody(host, port)).toBe(host);
      const status = await new Promise<number | undefined>((resolve, reject) => {
        get({ host, port, headers: { Host: 'untrusted.example' } }, (res) => {
          res.resume();
          resolve(res.statusCode);
        }).on('error', reject);
      });
      expect(status).toBe(403);
      const client = new WebSocket(`${getServerChannelUrl(port, { host })}?token=${options.token}`);
      clients.push(client);
      await once(client, 'open');
      const rejected = new WebSocket(
        `${getServerChannelUrl(port, { host })}?token=${options.token}&page=manager`,
        { origin: 'http://untrusted.example' }
      );
      clients.push(rejected);
      const rejection = await new Promise<number | undefined>((resolve, reject) => {
        rejected.once('error', reject);
        rejected.once('unexpected-response', (_req, res) => {
          res.resume();
          resolve(res.statusCode);
        });
      });
      expect(rejection).toBe(403);
      rejected.on('error', () => {});
      rejected.terminate();
      clients.pop();
      const message = once(client, 'message');
      transport.send({ type: 'listener-test', host });
      expect(String((await message)[0])).toContain(host);
    }
    for (const client of clients.splice(0)) {
      const closed = once(client, 'close');
      client.close();
      await closed;
    }
    transports.pop()!.close();
    await close(second);
    servers.pop();
    expect(await fetchBody('127.0.0.1', port)).toBe('127.0.0.1');
    expect(await tryConnect('::1', port)).toBe('ECONNREFUSED');
    const rebound = await listen('::1', port);
    await close(rebound);
  } finally {
    clients.forEach((client) => client.terminate());
    transports.forEach((transport) => transport.close());
    await Promise.all(servers.map(close));
  }
});

it('finds another port when the selected host is occupied', async () => {
  const server = await listen('127.0.0.1');
  const { port } = server.address() as AddressInfo;
  try {
    const available = await getServerPort(port, { host: '127.0.0.1' });
    expect(available).not.toBe(port);
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    try {
      await expect(getServerPort(port, { host: '127.0.0.1', exactPort: true })).rejects.toThrow(
        'exit'
      );
      expect(exit).toHaveBeenCalledWith(-1);
    } finally {
      exit.mockRestore();
    }
    const probe = await listen('127.0.0.1', available);
    await close(probe);
  } finally {
    await close(server);
  }
});

it.for(['0.0.0.0', '::'])(
  'keeps wildcard %s reachable through its local URL',
  async (host, context) => {
    let server: Server;
    try {
      server = await listen(host);
    } catch (error) {
      if (
        host === '::' &&
        ['EADDRNOTAVAIL', 'EAFNOSUPPORT'].includes((error as NodeJS.ErrnoException).code!)
      ) {
        context.skip();
        return;
      }
      throw error;
    }
    server.on('request', (_req, res) => res.end('wildcard'));
    const { port } = server.address() as AddressInfo;
    try {
      const { address } = getServerAddresses(port, host, 'http');
      const body = await new Promise<string>((resolve, reject) => {
        get(address, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => resolve(data));
        }).on('error', reject);
      });
      expect(body).toBe('wildcard');
    } finally {
      await close(server);
    }
  }
);

it('rejects invalid explicit-host port requests without retrying', async () => {
  await expect(getServerPort(-1, { host: '127.0.0.1' })).rejects.toMatchObject({
    code: 'ERR_SOCKET_BAD_PORT',
  });
});

it('rejects an unresolved explicit host instead of reporting an available port', async () => {
  await expect(getServerPort(6006, { host: 'storybook.invalid' })).rejects.toMatchObject({
    code: 'ENOTFOUND',
  });
});

describe('getListenHost', () => {
  it('binds to 127.0.0.1 when --host is not given', () => {
    expect(getListenHost(undefined)).toBe('127.0.0.1');
    expect(getListenHost('')).toBe('127.0.0.1');
  });

  it('can be reached through 127.0.0.1 and localhost when --host is not given', async () => {
    const server = await listen(getListenHost(undefined));
    const { port } = server.address() as AddressInfo;
    try {
      await expect(tryConnect('127.0.0.1', port)).resolves.toBe('connected');
      await expect(tryConnect('localhost', port)).resolves.toBe('connected');
    } finally {
      await close(server);
    }
  });

  it('keeps the --host value', () => {
    expect(getListenHost('0.0.0.0')).toBe('0.0.0.0');
    expect(getListenHost('my-host.com')).toBe('my-host.com');
  });

  describe.skipIf(!lanAddress)('on a machine with a LAN address', () => {
    it.each([undefined, ''])(
      'cannot be reached by the LAN address when --host is %j',
      async (host) => {
        const server = await listen(getListenHost(host));
        const { address, port } = server.address() as AddressInfo;
        try {
          expect(isLoopback(address)).toBe(true);
          await expect(tryConnect(lanAddress!, port)).resolves.toBe('ECONNREFUSED');
          await expect(tryConnect(address, port)).resolves.toBe('connected');
        } finally {
          await close(server);
        }
      }
    );

    it('only listens on the selected LAN address', async () => {
      const server = await listen(getListenHost(lanAddress));
      server.on('request', (req, res) => res.end(`served ${req.headers.host}`));
      const { port } = server.address() as AddressInfo;
      try {
        await expect(tryConnect('127.0.0.1', port)).resolves.toBe('ECONNREFUSED');
        await expect(fetchBody(lanAddress!, port)).resolves.toBe(`served ${lanAddress}:${port}`);
      } finally {
        await close(server);
      }
    });

    it('can be reached by the LAN address when --host is 0.0.0.0', async () => {
      const server = await listen(getListenHost('0.0.0.0'));
      const { port } = server.address() as AddressInfo;
      try {
        await expect(tryConnect(lanAddress!, port)).resolves.toBe('connected');
      } finally {
        await close(server);
      }
    });
  });
});
