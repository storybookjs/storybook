import net, { type AddressInfo } from 'node:net';
import os from 'node:os';

import { SERVER_CHANNEL_PATH } from 'storybook/internal/channels';
import { logger } from 'storybook/internal/node-logger';
import { NoFreePortError } from 'storybook/internal/server-errors';

/**
 * The address the dev server binds to. Without `--host`, Storybook binds to `127.0.0.1` only, so
 * other machines cannot reach it. An empty `--host` value is treated the same way, because Node
 * would otherwise bind to every interface.
 */
export const getListenHost = (host: string | undefined) => host || '127.0.0.1';

const COVERS_LOOPBACK = new Set(['127.0.0.1', '0.0.0.0', '::']);

const needsLoopbackListener = (address: string) => !COVERS_LOOPBACK.has(address);

/** Every address the dev server binds: the listen host, plus 127.0.0.1 from `addLoopbackListener`. */
export const getBoundHosts = (host: string | undefined) => {
  const listenHost = getListenHost(host);
  return needsLoopbackListener(listenHost) ? [listenHost, '127.0.0.1'] : [listenHost];
};

// Keeps the printed local address working when --host binds a single other address. Emitting
// 'connection' hands each socket to the same HTTP(S) server, so requests and upgrades share handlers.
export const addLoopbackListener = async (server: net.Server): Promise<net.Server | undefined> => {
  const { address, port } = server.address() as AddressInfo;
  if (!needsLoopbackListener(address)) {
    return undefined;
  }

  const loopback = net.createServer((socket) => server.emit('connection', socket));
  server.once('close', () => loopback.close());
  await new Promise<void>((resolve, reject) => {
    loopback.once('error', reject);
    loopback.listen({ port, host: '127.0.0.1' }, resolve);
  });
  return loopback;
};

export function getServerAddresses(
  port: number,
  host: string | undefined,
  proto: string,
  initialPath?: string
) {
  const address = new URL(`${proto}://127.0.0.1:${port}/`);
  const networkAddress = new URL(`${proto}://${host || getLocalIp()}:${port}/`);

  if (initialPath) {
    const searchParams = `?path=${decodeURIComponent(
      initialPath.startsWith('/') ? initialPath : `/${initialPath}`
    )}`;
    address.search = searchParams;
    networkAddress.search = searchParams;
  }

  return {
    address: address.href,
    networkAddress: networkAddress.href,
  };
}

// The server does not bind these, but a listener on them still takes the port: `localhost` can
// resolve to ::1, and on macOS a 127.0.0.1 bind succeeds next to a 0.0.0.0 or :: listener.
const SHARED_HOSTS = ['::1', '0.0.0.0'];
const PORT_TAKEN = new Set(['EADDRINUSE', 'EACCES', 'EPERM']);
const MISSING_ADDRESS = new Set(['EADDRNOTAVAIL', 'EAFNOSUPPORT']);

const bindOnce = (port: number, host: string) =>
  new Promise<number>((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen({ port, host }, () => {
      const { port: boundPort } = probe.address() as AddressInfo;
      probe.close(() => resolve(boundPort));
    });
  });

// Resolves the port when it is free on every host, and `undefined` when one of them has it taken.
const bindAll = async (port: number, host: string | undefined) => {
  const boundHosts = getBoundHosts(host);
  for (const probeHost of new Set([...boundHosts, ...SHARED_HOSTS])) {
    try {
      // With port 0 the OS picks a port on the first host, and the other hosts check that one.
      port = await bindOnce(port, probeHost);
    } catch (error) {
      const { code = '' } = error as NodeJS.ErrnoException;
      if (PORT_TAKEN.has(code)) {
        return undefined;
      }
      // A machine without IPv6 has no ::1, but a mistyped --host has to fail with its own error.
      if (MISSING_ADDRESS.has(code) && !boundHosts.includes(probeHost)) {
        continue;
      }
      throw error;
    }
  }
  return port;
};

// Same search as detect-port: the requested port and the 9 after it, then ports the OS picks.
const findFreePort = async (port: number | undefined, host: string | undefined) => {
  const nearby = port
    ? Array.from({ length: 10 }, (_, i) => port + i).filter((p) => p <= 65535)
    : [];
  for (const candidate of [...nearby, 0, 0, 0]) {
    const freePort = await bindAll(candidate, host);
    if (freePort) {
      return freePort;
    }
  }
  return undefined;
};

interface PortOptions {
  exactPort?: boolean;
  /**
   * Pass the same value as the dev server's `--host`. The port is checked on every address the
   * server binds for it, and on ::1 and 0.0.0.0.
   */
  host?: string;
}

export const getServerPort = (port?: number, { exactPort, host }: PortOptions = {}) =>
  findFreePort(port, host)
    .catch((error) => {
      logger.error(error);
      process.exit(-1);
    })
    .then((freePort) => {
      // Every bind is refused in some environments, e.g. sandboxed shells that deny listening on
      // network ports. Throwing (instead of exiting) lets `storybook dev` report the error through
      // telemetry and lets `storybook init`, which probes for a port opportunistically, recover.
      if (!freePort) {
        throw new NoFreePortError({ requestedPort: port });
      }
      if (exactPort && port != null && freePort !== port) {
        logger.error(`Port ${port} is not available. Exiting because --exact-port was provided.`);
        process.exit(-1);
      }
      return freePort;
    });

export const getServerChannelUrl = (port: number, { https }: { https?: boolean }) => {
  return `${https ? 'wss' : 'ws'}://127.0.0.1:${port}${SERVER_CHANNEL_PATH}`;
};

const getExternalIpv4Addresses = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((ip) => ip && ip.family === 'IPv4' && !ip.internal)
    .map((ip) => ip!.address);

const getLocalIp = () => getExternalIpv4Addresses()[0] ?? '0.0.0.0';

// 0.0.0.0 listens on every IPv4 interface, so each external IPv4 address reaches the server.
export const getReachableNetworkAddresses = (networkAddress: string): string[] => {
  if (new URL(networkAddress).hostname !== '0.0.0.0') {
    return [networkAddress];
  }
  const addresses = getExternalIpv4Addresses().map((ip) => {
    const url = new URL(networkAddress);
    url.hostname = ip;
    return url.href;
  });
  return addresses.length ? addresses : [networkAddress];
};
