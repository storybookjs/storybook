import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import type { EmbedRequest } from '../../types/index.ts';
import { isValidToken } from './validate-token.ts';

const EMBED_PATH = /^\/embed\/([^/?]+)(\/.*)$/;

// A sandboxed frame loads modules as CORS requests with `Origin: null`, which any website can
// send, so only URLs under the unguessable embed base are made readable to it.
export function attachEmbedAccess(server: Server, token: string = randomUUID()) {
  const embedBase = `/embed/${token}/`;
  // Polka matches routes before running middleware, so the base is stripped ahead of it.
  server.prependListener('request', (req: EmbedRequest, res) => {
    // Reads only: a preflight answered here would open routes like the MCP endpoint to the frame.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return;
    }
    const [, requestToken, path] = EMBED_PATH.exec(req.url ?? '') ?? [];
    if (!isValidToken(requestToken ?? null, token)) {
      return;
    }
    req.url = path;
    req.embedBase = embedBase;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Referrer-Policy', 'no-referrer');
  });
  return embedBase;
}
