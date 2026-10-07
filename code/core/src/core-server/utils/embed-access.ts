import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';

import type { Middleware } from '../../types/index.ts';
import { isValidToken } from './validate-token.ts';

const listensOnLoopback = (host?: string) =>
  !host || ['localhost', '127.0.0.1', '::1', '0.0.0.0', '::'].includes(host);

// Pages hold the channel token, and a frame navigates to them without reading them. Routes match
// paths loosely, so what counts as a page is decided by the response, not by the URL.
function keepPagesUnreadable(res: ServerResponse) {
  const { writeHead } = res;
  res.writeHead = function (this: ServerResponse, ...args: unknown[]) {
    const headers = args.find((arg) => typeof arg === 'object' && arg && !Array.isArray(arg));
    const [, passedType] =
      Object.entries(headers ?? {}).find(([name]) => name.toLowerCase() === 'content-type') ?? [];
    const type = String(passedType ?? res.getHeader('content-type') ?? 'text/html');
    // A 304 has no type and no body; the cached file it confirms must stay readable.
    if (args[0] !== 304 && type.startsWith('text/html')) {
      res.removeHeader('Access-Control-Allow-Origin');
    }
    return writeHead.apply(this, args as Parameters<typeof writeHead>);
  } as typeof writeHead;
}

// `Origin: null` is what a sandboxed frame sends and what any site can forge, so the credential
// is an unguessable `*.localhost` hostname instead.
export function createEmbedAccess(localAddress: string, host?: string) {
  const url = new URL(localAddress);
  url.hostname = `sb-${randomUUID()}.localhost`;

  const middleware: Middleware = (req, res, next) => {
    if (isValidToken(req.headers.host, url.host)) {
      res.setHeader('Referrer-Policy', 'no-referrer');
      if (req.method === 'GET' || req.method === 'HEAD') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        keepPagesUnreadable(res);
      }
    }
    next();
  };

  return { middleware, origin: listensOnLoopback(host) ? url.origin : undefined };
}
