import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';

import { isValidToken } from './validate-token.ts';

const embedToken = randomUUID();
const EMBED_PATH = /^\/embed\/([^/?]+)(\/.*)$/;
const FONT_PATH = /\.(woff2?|ttf|otf|eot)$/i;

export type EmbedRequest = IncomingMessage & { storybookEmbedBase?: string };

export const getEmbedBase = () => `/embed/${embedToken}/`;

// A sandboxed frame loads modules as CORS requests with `Origin: null`, which any website can
// send, so only URLs under the unguessable base are made readable to it.
export function attachEmbedAccess(server: Server, token: string = embedToken) {
  // Polka matches routes before running middleware, so the base is stripped ahead of it.
  server.prependListener('request', (req: EmbedRequest, res) => {
    // Reads only: a preflight answered here would open routes like the MCP endpoint to the frame.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return;
    }
    // CSS `url()` cannot be moved under the embed base, and fonts are the one thing it loads with
    // CORS. Font files are not sources, so they are readable from any origin.
    if (FONT_PATH.test((req.url ?? '').split('?')[0])) {
      res.setHeader('Access-Control-Allow-Origin', '*');
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
