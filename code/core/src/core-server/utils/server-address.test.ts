import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import {
  getBoundHosts,
  getReachableNetworkAddresses,
  getServerAddresses,
  getServerChannelUrl,
  getServerPort,
} from './server-address.ts';

vi.mock('node:os', () => ({
  default: {
    release: () => '',
    networkInterfaces: () => ({
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      eth0: [
        { address: '192.168.1.100', family: 'IPv4', internal: false },
        { address: 'fe80::1', family: 'IPv6', internal: false },
      ],
      wlan0: [{ address: '192.130.20.4', family: 'IPv4', internal: false }],
    }),
  },
  platform: 'darwin',
  constants: {
    signals: {},
  },
}));
// Each probe bind asks `bind(port, host)`: a number is the port it binds, a string the error code.
const { bind } = vi.hoisted(() => ({
  bind: vi.fn<(port: number, host: string) => number | string>(),
}));
vi.mock('node:net', () => {
  const createServer = () => {
    let onError: (error: Error) => void = () => {};
    let boundPort = 0;
    const server = {
      once: (_event: 'error', handler: (error: Error) => void) => {
        onError = handler;
        return server;
      },
      listen: ({ port, host }: { port: number; host: string }, onListening: () => void) => {
        const result = bind(port, host);
        if (typeof result === 'string') {
          queueMicrotask(() => onError(Object.assign(new Error(result), { code: result })));
        } else {
          boundPort = result;
          queueMicrotask(onListening);
        }
        return server;
      },
      address: () => ({ port: boundPort }),
      close: (onClose: () => void) => onClose(),
    };
    return server;
  };
  return { default: { createServer }, createServer };
});
vi.mock('storybook/internal/node-logger');

describe('getServerAddresses', () => {
  const port = 3000;
  const host = 'localhost';
  const proto = 'http';

  it('should return server addresses without initial path by default', () => {
    const expectedAddress = `${proto}://127.0.0.1:${port}/`;
    const expectedNetworkAddress = `${proto}://${host}:${port}/`;

    const result = getServerAddresses(port, host, proto);

    expect(result.address).toBe(expectedAddress);
    expect(result.networkAddress).toBe(expectedNetworkAddress);
  });

  it('should return server addresses with initial path', () => {
    const initialPath = '/foo/bar';

    const expectedAddress = `${proto}://127.0.0.1:${port}/?path=/foo/bar`;
    const expectedNetworkAddress = `${proto}://${host}:${port}/?path=/foo/bar`;

    const result = getServerAddresses(port, host, proto, initialPath);

    expect(result.address).toBe(expectedAddress);
    expect(result.networkAddress).toBe(expectedNetworkAddress);
  });

  it('should return server addresses with initial path and add slash if missing', () => {
    const initialPath = 'foo/bar';

    const expectedAddress = `${proto}://127.0.0.1:${port}/?path=/foo/bar`;
    const expectedNetworkAddress = `${proto}://${host}:${port}/?path=/foo/bar`;

    const result = getServerAddresses(port, host, proto, initialPath);

    expect(result.address).toBe(expectedAddress);
    expect(result.networkAddress).toBe(expectedNetworkAddress);
  });
});

describe('getReachableNetworkAddresses', () => {
  it('lists every external IPv4 address of the machine when the host is 0.0.0.0', () => {
    expect(getReachableNetworkAddresses('http://0.0.0.0:6006/?path=/foo/bar')).toEqual([
      'http://192.168.1.100:6006/?path=/foo/bar',
      'http://192.130.20.4:6006/?path=/foo/bar',
    ]);
  });

  it.each(['http://192.168.1.100:6006/', 'https://my-host.com:6006/'])(
    'keeps %s as it is',
    (networkAddress) => {
      expect(getReachableNetworkAddresses(networkAddress)).toEqual([networkAddress]);
    }
  );
});

describe('getBoundHosts', () => {
  it('lists the listen host, plus 127.0.0.1 when the listen host does not cover it', () => {
    expect(getBoundHosts(undefined)).toEqual(['127.0.0.1']);
    expect(getBoundHosts('0.0.0.0')).toEqual(['0.0.0.0']);
    expect(getBoundHosts('::')).toEqual(['::']);
    expect(getBoundHosts('192.168.1.100')).toEqual(['192.168.1.100', '127.0.0.1']);
  });
});

describe('getServerPort', () => {
  const port = 3000;
  const probedHosts = () => bind.mock.calls.map(([, host]) => host);

  beforeEach(() => {
    bind.mockReset();
    bind.mockImplementation((requested) => requested || 5000);
  });

  it('should resolve with the requested port when it is free', async () => {
    await expect(getServerPort(port)).resolves.toBe(port);
  });

  it('should resolve with the next port when the requested one is taken on any probed host', async () => {
    bind.mockImplementation((requested, host) =>
      requested === port && host === '::1' ? 'EADDRINUSE' : requested
    );

    await expect(getServerPort(port)).resolves.toBe(port + 1);
  });

  it.each([
    [undefined, ['127.0.0.1', '::1', '0.0.0.0']],
    ['0.0.0.0', ['0.0.0.0', '::1']],
    ['192.168.1.100', ['192.168.1.100', '127.0.0.1', '::1', '0.0.0.0']],
  ])('should check the port on every host the server binds for --host %s', async (host, hosts) => {
    await getServerPort(port, { host });

    expect(probedHosts()).toEqual(hosts);
    expect(bind.mock.calls.every(([requested]) => requested === port)).toBe(true);
  });

  it('should treat a missing ::1 as free', async () => {
    bind.mockImplementation((requested, host) => (host === '::1' ? 'EADDRNOTAVAIL' : requested));

    await expect(getServerPort(port)).resolves.toBe(port);
  });

  it('should log the error and exit when the --host address does not exist', async () => {
    bind.mockImplementation((requested, host) =>
      host === '10.0.0.99' ? 'EADDRNOTAVAIL' : requested
    );
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as () => never);

    try {
      await getServerPort(port, { host: '10.0.0.99' }).catch(() => {});

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'EADDRNOTAVAIL' }));
      expect(exit).toHaveBeenCalledWith(-1);
    } finally {
      exit.mockRestore();
    }
  });

  it('should check the port the OS picks on the other hosts too', async () => {
    bind.mockImplementation((requested, host) =>
      host === '127.0.0.1' && !requested ? 5000 : requested
    );

    await expect(getServerPort(undefined)).resolves.toBe(5000);
    expect(bind.mock.calls).toEqual([
      [0, '127.0.0.1'],
      [5000, '::1'],
      [5000, '0.0.0.0'],
    ]);
  });

  it('should reject with an actionable error when no port can be bound', async () => {
    // Sandboxed shells can refuse every bind attempt.
    bind.mockReturnValue('EPERM');

    await expect(getServerPort(port)).rejects.toThrow(
      "Unable to find a free port for Storybook's dev server"
    );
  });

  it('should log an error and exit when the port is taken and exactPort is set', async () => {
    bind.mockImplementation((requested) => (requested === port ? 'EADDRINUSE' : requested));
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

  it('should not exit for exactPort when no port was requested', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as () => never);

    try {
      const result = await getServerPort(undefined, { exactPort: true });

      expect(result).toBe(5000);
      expect(exit).not.toHaveBeenCalled();
    } finally {
      exit.mockRestore();
    }
  });
});

describe('getServerChannelUrl', () => {
  const port = 3000;
  it('should return WebSocket URL with HTTP', () => {
    const options = { https: false };
    const expectedUrl = `ws://127.0.0.1:${port}/storybook-server-channel`;

    const result = getServerChannelUrl(port, options);

    expect(result).toBe(expectedUrl);
  });

  it('should return WebSocket URL with HTTPS', () => {
    const options = { https: true };
    const expectedUrl = `wss://127.0.0.1:${port}/storybook-server-channel`;

    const result = getServerChannelUrl(port, options);

    expect(result).toBe(expectedUrl);
  });
});
