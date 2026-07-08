import os from 'node:os';

import { logger } from 'storybook/internal/node-logger';
import { NoFreePortError } from 'storybook/internal/server-errors';

import detectFreePort from 'detect-port';

export function getServerAddresses(
  port: number,
  host: string | undefined,
  proto: string,
  initialPath?: string
) {
  const address = new URL(`${proto}://localhost:${port}/`);
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
  return `${https ? 'wss' : 'ws'}://localhost:${port}/storybook-server-channel`;
};

const getLocalIp = () => {
  const allIps = Object.values(os.networkInterfaces()).flat();
  const allFilteredIps = allIps.filter((ip) => ip && ip.family === 'IPv4' && !ip.internal);

  return allFilteredIps.length ? allFilteredIps[0]?.address : '0.0.0.0';
};
