import { describe, expect, it } from 'vitest';

import { createServer, get, type Server } from 'node:http';
import { type AddressInfo, connect } from 'node:net';
import os from 'node:os';

import { addLoopbackListener, getListenHost } from './server-address.ts';

const lanAddress = Object.values(os.networkInterfaces())
  .flat()
  .find((iface) => iface?.family === 'IPv4' && !iface.internal)?.address;

const listen = async (host: string) => {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ port: 0, host }, resolve);
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

  it.each(['127.0.0.1', '0.0.0.0'])(
    'adds no loopback listener when the server already listens on %s',
    async (host) => {
      const server = await listen(host);
      try {
        await expect(addLoopbackListener(server)).resolves.toBeUndefined();
      } finally {
        await close(server);
      }
    }
  );

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

    it('can also be reached through 127.0.0.1 when --host is the LAN address', async () => {
      const server = await listen(getListenHost(lanAddress));
      server.on('request', (req, res) => res.end(`served ${req.headers.host}`));
      const { port } = server.address() as AddressInfo;
      try {
        await expect(addLoopbackListener(server)).resolves.toBeDefined();
        await expect(fetchBody('127.0.0.1', port)).resolves.toBe(`served 127.0.0.1:${port}`);
        await expect(fetchBody(lanAddress!, port)).resolves.toBe(`served ${lanAddress}:${port}`);
      } finally {
        await close(server);
      }
      await expect(tryConnect('127.0.0.1', port)).resolves.toBe('ECONNREFUSED');
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
