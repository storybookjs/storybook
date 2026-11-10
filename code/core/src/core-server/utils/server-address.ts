import net, { type AddressInfo } from 'node:net';
import os from 'node:os';

import { SERVER_CHANNEL_PATH } from 'storybook/internal/channels';
import { logger } from 'storybook/internal/node-logger';
import { NoFreePortError } from 'storybook/internal/server-errors';

import detectFreePort from 'detect-port';

/**
 * The address the dev server binds to. Without `--host`, Storybook binds to `127.0.0.1` only, so
 * other machines cannot reach it. An empty `--host` value is treated the same way, because Node
 * would otherwise bind to every interface.
 */
export const getListenHost = (host: string | undefined) => host || '127.0.0.1';

const COVERS_LOOPBACK = new Set(['127.0.0.1', '0.0.0.0', '::']);

// Keeps the printed local address working when --host binds a single other address. Emitting
// 'connection' hands each socket to the same HTTP(S) server, so requests and upgrades share handlers.
export const addLoopbackListener = async (server: net.Server): Promise<net.Server | undefined> => {
  const { address, port } = server.address() as AddressInfo;
  if (COVERS_LOOPBACK.has(address)) {
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

interface PortOptions {
  exactPort?: boolean;
  host?: string;
}

// Without a hostname, detect-port reads the network interfaces in a listen callback, where a
// throw cannot be caught. Probe the listen host directly when the interfaces cannot be read.
const canReadNetworkInterfaces = () => {
  try {
    os.networkInterfaces();
    return true;
  } catch {
    return false;
  }
};

const tryListen = (port: number, host: string) =>
  new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, host, () => {
      const { port: freePort } = server.address() as AddressInfo;
      server.close(() => resolve(freePort));
    });
  });

// Tries the same ports as detect-port (the requested one, the next nine, then a random one), but
// gives up after that. detect-port with a hostname keeps retrying forever when every bind fails.
const findFreePortOnHost = async (port: number | undefined, host: string) => {
  const candidates = port
    ? Array.from({ length: Math.min(10, 65535 - port) }, (_, i) => port + i)
    : [];
  for (const candidate of [...candidates, 0]) {
    try {
      return await tryListen(candidate, host);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EADDRNOTAVAIL') {
        return undefined;
      }
    }
  }
  return undefined;
};

export const getServerPort = (port?: number, { exactPort, host }: PortOptions = {}) =>
  (canReadNetworkInterfaces()
    ? detectFreePort(port)
    : findFreePortOnHost(port, getListenHost(host))
  )
    .catch((error) => {
      logger.error(error);
      process.exit(-1);
    })
    .then((freePort) => {
      // detect-port resolves `undefined` instead of rejecting when the environment refuses
      // every bind attempt, e.g. sandboxed shells that deny listening on network ports.
      // Throwing (instead of exiting) lets `storybook dev` report the error through telemetry
      // and lets `storybook init`, which probes for a port opportunistically, recover from it.
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

// Sandboxed environments can deny listing the network interfaces, which makes Node throw.
export const getNetworkInterfaces = () => {
  try {
    return os.networkInterfaces();
  } catch {
    return {};
  }
};

const getExternalIpv4Addresses = () =>
  Object.values(getNetworkInterfaces())
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
