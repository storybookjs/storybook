import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';

import { isValidToken } from './validate-token.ts';

const embedToken = randomUUID();
const EMBED_PATH = /^\/embed\/([^/?]+)(\/.*)$/;

export type EmbedRequest = IncomingMessage & { storybookEmbedBase?: string };

export const getEmbedBase = () => `/embed/${embedToken}/`;

// A sandboxed frame loads modules as CORS requests with `Origin: null`, which any website can
// send, so only URLs under the unguessable base are made readable to it.
export function attachEmbedAccess(server: Server, token: string = embedToken) {
  // Polka matches routes before running middleware, so the base is stripped ahead of it.
  server.prependListener('request', (req: EmbedRequest, res) => {
    const [, requestToken, path] = EMBED_PATH.exec(req.url ?? '') ?? [];
    // Reads only: a preflight answered here would open routes like the MCP endpoint to the frame.
    const isRead = req.method === 'GET' || req.method === 'HEAD';
    if (!isRead || !isValidToken(requestToken ?? null, token)) {
      return;
    }
    req.url = path;
    req.storybookEmbedBase = `/embed/${token}/`;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Referrer-Policy', 'no-referrer');
  });
}
