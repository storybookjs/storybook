import { randomUUID } from 'node:crypto';

import type { Middleware } from '../../types/index.ts';
import { isValidToken } from './validate-token.ts';

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '::1', '0.0.0.0', '::'];

// A sandboxed frame sends `Origin: null`, and so can any website, so the origin cannot earn
// permission to read. The hostname can: every `*.localhost` name resolves to loopback, and only
// those who were told this unguessable one can address requests to it.
export function createEmbedAccess(localAddress: string, host?: string) {
  const url = new URL(localAddress);
  url.hostname = `sb-${randomUUID()}.localhost`;

  const middleware: Middleware = (req, res, next) => {
    if (isValidToken(req.headers.host ?? null, url.host)) {
      res.setHeader('Referrer-Policy', 'no-referrer');
      const isRead = req.method === 'GET' || req.method === 'HEAD';
      // A frame navigates to pages and never reads them, and they hold the channel token that
      // allows writes.
      const isPage = /(\/|\.html)$/.test((req.url ?? '').split('?')[0]);
      if (isRead && !isPage) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
    }
    next();
  };

  const listensOnLoopback = !host || LOOPBACK_HOSTS.includes(host);
  return { middleware, origin: listensOnLoopback ? url.origin : undefined };
}
