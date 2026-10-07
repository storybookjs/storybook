import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

import { isValidToken } from './validate-token.ts';

const embedToken = randomUUID();
const EMBED_PATH = /^\/embed\/([^/?]+)(\/.*)$/;
const FONT_PATH = /\.(woff2?|ttf|otf)$/i;

export type EmbedRequest = IncomingMessage & { storybookEmbedBase?: string };

export const getEmbedBase = () => `/embed/${embedToken}/`;

// CSS `url()` cannot be moved under the embed base, and fonts are the one thing it loads with CORS.
// A route can answer any path, so the response has to say it is a font before any origin may read it.
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

// A sandboxed frame loads modules as CORS requests with `Origin: null`, which any website can
// send, so only URLs under the unguessable base are made readable to it.
export function attachEmbedAccess(server: Server, token: string = embedToken) {
  // Polka matches routes before running middleware, so the base is stripped ahead of it.
  server.prependListener('request', (req: EmbedRequest, res) => {
    // Reads only: a preflight answered here would open routes like the MCP endpoint to the frame.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return;
    }
    if (FONT_PATH.test((req.url ?? '').split('?')[0])) {
      allowFontResponse(res);
    }
    const [, requestToken, path] = EMBED_PATH.exec(req.url ?? '') ?? [];
    if (!isValidToken(requestToken ?? null, token)) {
      return;
    }
    req.url = path;
    req.storybookEmbedBase = `/embed/${token}/`;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Referrer-Policy', 'no-referrer');
  });
}
