import type { IncomingMessage } from 'node:http';

export const SERVER_CHANNEL_PATH = '/storybook-server-channel';

export function createProxyPathFilter({
  basePath,
  channelPath = SERVER_CHANNEL_PATH,
}: {
  basePath: string;
  channelPath?: string;
}) {
  const prefix = basePath.replace(/\/+$/, '');

  return (pathname: string, req: IncomingMessage): boolean => {
    const protocols = String(req.headers['sec-websocket-protocol'] ?? '')
      .split(',')
      .map((protocol) => protocol.trim());
    if (protocols.includes('vite-hmr') || protocols.includes('vite-ping')) {
      return false;
    }

    if (pathname === channelPath || pathname.startsWith(`${channelPath}/`)) {
      return false;
    }

    if (prefix && pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
      return false;
    }

    return true;
  };
}
