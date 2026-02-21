import net from 'node:net';
import os from 'node:os';

import { logger } from 'storybook/internal/node-logger';

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

/**
 * Checks if a given port is available by attempting to bind a TCP server to it.
 * Returns the port if available, or rejects with an error if it is in use.
 * This avoids shelling out to `ps` (which fails on Alpine/BusyBox environments).
 */
function checkPort(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(port, () => {
      const { port: assignedPort } = server.address() as net.AddressInfo;
      server.close(() => resolve(assignedPort));
    });
  });
}

/**
 * Finds a free port starting from the given port number.
 * Falls back to an OS-assigned port (port 0) when the requested port is unavailable.
 */
export function detectFreePort(port?: number): Promise<number> {
  return checkPort(port || 0).catch((err) => {
    if (err.code === 'EADDRINUSE') {
      // Let the OS assign a free port
      return checkPort(0);
    }
    return Promise.reject(err);
  });
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
  return `${https ? 'wss' : 'ws'}://localhost:${port}/storybook-server-channel`;
};

const getLocalIp = () => {
  const allIps = Object.values(os.networkInterfaces()).flat();
  const allFilteredIps = allIps.filter((ip) => ip && ip.family === 'IPv4' && !ip.internal);

  return allFilteredIps.length ? allFilteredIps[0]?.address : '0.0.0.0';
};
