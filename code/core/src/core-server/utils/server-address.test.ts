import net from 'node:net';

import { describe, expect, it, vi } from 'vitest';

import { getServerAddresses, getServerChannelUrl, getServerPort } from './server-address';

vi.mock('node:os', () => ({
  default: { release: () => '' },
  platform: 'darwin',
  constants: {
    signals: {},
  },
}));
vi.mock('node:net');
vi.mock('storybook/internal/node-logger');

describe('getServerAddresses', () => {
  const port = 3000;
  const host = 'localhost';
  const proto = 'http';

  it('should return server addresses without initial path by default', () => {
    const expectedAddress = `${proto}://localhost:${port}/`;
    const expectedNetworkAddress = `${proto}://${host}:${port}/`;

    const result = getServerAddresses(port, host, proto);

    expect(result.address).toBe(expectedAddress);
    expect(result.networkAddress).toBe(expectedNetworkAddress);
  });

  it('should return server addresses with initial path', () => {
    const initialPath = '/foo/bar';

    const expectedAddress = `${proto}://localhost:${port}/?path=/foo/bar`;
    const expectedNetworkAddress = `${proto}://${host}:${port}/?path=/foo/bar`;

    const result = getServerAddresses(port, host, proto, initialPath);

    expect(result.address).toBe(expectedAddress);
    expect(result.networkAddress).toBe(expectedNetworkAddress);
  });

  it('should return server addresses with initial path and add slash if missing', () => {
    const initialPath = 'foo/bar';

    const expectedAddress = `${proto}://localhost:${port}/?path=/foo/bar`;
    const expectedNetworkAddress = `${proto}://${host}:${port}/?path=/foo/bar`;

    const result = getServerAddresses(port, host, proto, initialPath);

    expect(result.address).toBe(expectedAddress);
    expect(result.networkAddress).toBe(expectedNetworkAddress);
  });
});

describe('getServerPort', () => {
  const port = 3000;

  it('should resolve with a free port', async () => {
    const expectedFreePort = 4000;

    const mockServer = {
      unref: vi.fn(),
      on: vi.fn(),
      listen: vi.fn((_port: number, cb: () => void) => {
        cb();
        return mockServer;
      }),
      address: vi.fn(() => ({ port: expectedFreePort })),
      close: vi.fn((cb: () => void) => cb()),
    };
    vi.mocked(net.createServer).mockReturnValue(mockServer as unknown as net.Server);

    const result = await getServerPort(port);

    expect(result).toBe(expectedFreePort);
  });
});

describe('getServerChannelUrl', () => {
  const port = 3000;
  it('should return WebSocket URL with HTTP', () => {
    const options = { https: false };
    const expectedUrl = `ws://localhost:${port}/storybook-server-channel`;

    const result = getServerChannelUrl(port, options);

    expect(result).toBe(expectedUrl);
  });

  it('should return WebSocket URL with HTTPS', () => {
    const options = { https: true };
    const expectedUrl = `wss://localhost:${port}/storybook-server-channel`;

    const result = getServerChannelUrl(port, options);

    expect(result).toBe(expectedUrl);
  });
});
