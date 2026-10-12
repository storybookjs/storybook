import net, { type AddressInfo } from 'node:net';
import os from 'node:os';

import { logger } from '@storybook/core/node-logger';

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
}

export const getServerPort = (port?: number, { exactPort }: PortOptions = {}) =>
  detectFreePort(port)
    .then((freePort) => {
      if (freePort !== port && exactPort) {
        process.exit(-1);
      }
      return freePort;
    })
    .catch((error) => {
      logger.error(error);
      process.exit(-1);
    });

export const getServerChannelUrl = (port: number, { https }: { https?: boolean }) => {
  return `${https ? 'wss' : 'ws'}://127.0.0.1:${port}/storybook-server-channel`;
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
