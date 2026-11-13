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

const getConnectionHost = (host: string | undefined) => {
  if (host === '::') {
    return '::1';
  }
  return !host || host === '0.0.0.0' ? '127.0.0.1' : host;
};

const formatHost = (host: string) => (net.isIP(host) === 6 ? `[${host}]` : host);

const detectHostPort = async (port: number | undefined, host: string): Promise<number> => {
  let candidate = port ?? 0;
  const maxPort = Math.min(candidate + 10, 65535);
  for (;;) {
    try {
      return await new Promise<number>((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen({ port: candidate, host }, () => {
          const { port: boundPort } = server.address() as AddressInfo;
          server.close((error) => (error ? reject(error) : resolve(boundPort)));
        });
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || candidate === 0) {
        throw error;
      }
      candidate = candidate + 1 < maxPort ? candidate + 1 : 0;
    }
  }
};

export function getServerAddresses(
  port: number,
  host: string | undefined,
  proto: string,
  initialPath?: string
) {
  const address = new URL(`${proto}://${formatHost(getConnectionHost(host))}:${port}/`);
  const networkAddress = new URL(`${proto}://${formatHost(host || getLocalIp())}:${port}/`);

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

export const getServerPort = (port?: number, { exactPort, host }: PortOptions = {}) =>
  (host
    ? detectHostPort(port, host)
    : detectFreePort(port).catch((error) => {
        logger.error(error);
        process.exit(-1);
      })
  ).then((freePort) => {
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

export const getServerChannelUrl = (
  port: number,
  { https, host }: { https?: boolean; host?: string }
) => {
  return `${https ? 'wss' : 'ws'}://${formatHost(getConnectionHost(host))}:${port}${SERVER_CHANNEL_PATH}`;
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
