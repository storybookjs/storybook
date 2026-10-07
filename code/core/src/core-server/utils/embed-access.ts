import { randomUUID } from 'node:crypto';

import type { Middleware } from '../../types/index.ts';
import { isValidToken } from './validate-token.ts';

// Browsers and operating systems resolve every `*.localhost` name to loopback, so an unguessable
// subdomain is a secret that every request of the preview carries without changing its URLs.
export const createEmbedHostname = () => `sb-${randomUUID()}.localhost`;

// A sandboxed frame loads modules as CORS requests with `Origin: null`, which any website can
// send, so only requests to the unguessable hostname are made readable to it. The HTML documents
// stay unreadable: a frame navigates to them, and they carry the channel token that allows writes.
export function getEmbedAccessMiddleware(embedHostname: string): Middleware {
  return (req, res, next) => {
    const hostname = req.headers.host?.replace(/:\d+$/, '') ?? null;
    if (!isValidToken(hostname, embedHostname)) {
      next();
      return;
    }
    res.setHeader('Referrer-Policy', 'no-referrer');
    const isRead = req.method === 'GET' || req.method === 'HEAD';
    const path = (req.url ?? '').split('?')[0];
    const isDocument = path.endsWith('/') || path.endsWith('.html');
    if (isRead && !isDocument) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    next();
  };
}
