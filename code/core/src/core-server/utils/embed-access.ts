import { randomUUID } from 'node:crypto';

import type { Middleware } from '../../types/index.ts';
import { isValidToken } from './validate-token.ts';

const listensOnLoopback = (host?: string) =>
  !host || ['localhost', '127.0.0.1', '::1', '0.0.0.0', '::'].includes(host);

// `Origin: null` is what a sandboxed frame sends and what any site can forge, so the credential
// is an unguessable `*.localhost` hostname instead.
export function createEmbedAccess(localAddress: string, host?: string) {
  const url = new URL(localAddress);
  url.hostname = `sb-${randomUUID()}.localhost`;

  const middleware: Middleware = (req, res, next) => {
    if (isValidToken(req.headers.host, url.host)) {
      res.setHeader('Referrer-Policy', 'no-referrer');
      const isRead = req.method === 'GET' || req.method === 'HEAD';
      // Pages hold the channel token, and a frame navigates to them without reading them.
      const isPage = /\/$|\.html$/.test(new URL(req.url ?? '/', url).pathname);
      if (isRead && !isPage) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
    }
    next();
  };

  return { middleware, origin: listensOnLoopback(host) ? url.origin : undefined };
}
