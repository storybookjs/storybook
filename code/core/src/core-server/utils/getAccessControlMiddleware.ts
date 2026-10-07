import type { ServerResponse } from 'node:http';

import type { Middleware } from '../../types/index.ts';

const FONT_PATH = /\.(woff2?|ttf|otf)$/i;

// CSS `url()` loads fonts with CORS, and a sandboxed frame cannot send those loads through the embed
// base. A route can answer any path, so the response has to say it is a font before any origin may
// read it.
function allowFontResponse(res: ServerResponse) {
  const { writeHead } = res;
  res.writeHead = function (this: ServerResponse, ...args: unknown[]) {
    const headers = args.find((arg) => typeof arg === 'object' && arg && !Array.isArray(arg));
    const [, passedType] =
      Object.entries(headers ?? {}).find(([name]) => name.toLowerCase() === 'content-type') ?? [];
    if (String(passedType ?? res.getHeader('content-type')).startsWith('font/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    return writeHead.apply(this, args as Parameters<typeof writeHead>);
  } as typeof writeHead;
}

export function getAccessControlMiddleware(crossOriginIsolated: boolean): Middleware {
  return (req, res, next) => {
    // These headers are required to enable SharedArrayBuffer
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
    if (crossOriginIsolated) {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }
    const isRead = req.method === 'GET' || req.method === 'HEAD';
    if (isRead && FONT_PATH.test((req.url ?? '').split('?')[0])) {
      allowFontResponse(res);
    }
    next();
  };
}
