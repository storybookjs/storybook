import { randomUUID } from 'node:crypto';

import type { Middleware } from '../../types/index.ts';
import { isValidToken } from './validate-token.ts';

// Browsers and operating systems resolve every `*.localhost` name to loopback, so an unguessable
// subdomain is a secret that every request of the preview carries without changing its URLs.
export const createEmbedHostname = () => `sb-${randomUUID()}.localhost`;

// A sandboxed frame loads modules as CORS requests with `Origin: null`, which any website can
// send, so only requests to the unguessable hostname are made readable to it.
export function getEmbedAccessMiddleware(embedHostname: string): Middleware {
  return (req, res, next) => {
    // Reads only: a preflight answered here would open routes like the MCP endpoint to the frame.
    const isRead = req.method === 'GET' || req.method === 'HEAD';
    const hostname = req.headers.host?.replace(/:\d+$/, '') ?? null;
    if (isRead && isValidToken(hostname, embedHostname)) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Referrer-Policy', 'no-referrer');
    }
    next();
  };
}
