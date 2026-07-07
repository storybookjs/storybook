import { describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import detectPort from 'detect-port';

import { getServerAddresses, getServerChannelUrl, getServerPort } from './server-address.ts';

vi.mock('node:os', () => ({
  default: { release: () => '' },
  platform: 'darwin',
  constants: {
    signals: {},
  },
}));
vi.mock('detect-port');
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

    vi.mocked(detectPort).mockResolvedValue(expectedFreePort);

    const result = await getServerPort(port);

    expect(result).toBe(expectedFreePort);
  });

  it('should log an actionable error and exit when no port can be bound', async () => {
    // detect-port resolves `undefined` instead of rejecting when the environment
    // refuses every bind attempt (e.g. sandboxed shells).
    vi.mocked(detectPort).mockResolvedValue(undefined as unknown as number);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as () => never);

    try {
      await getServerPort(port);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Unable to find a free port for Storybook's dev server"),
        })
      );
      expect(exit).toHaveBeenCalledWith(-1);
    } finally {
      exit.mockRestore();
    }
  });

  it('should log an error and exit when the port is taken and exactPort is set', async () => {
    vi.mocked(detectPort).mockResolvedValue(4000);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as () => never);

    try {
      await getServerPort(port, { exactPort: true });

      expect(logger.error).toHaveBeenCalledWith(
        `Port ${port} is not available. Exiting because --exact-port was provided.`
      );
      expect(exit).toHaveBeenCalledWith(-1);
    } finally {
      exit.mockRestore();
    }
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
