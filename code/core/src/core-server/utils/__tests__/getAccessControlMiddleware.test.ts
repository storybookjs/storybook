import { type IncomingMessage, ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { getAccessControlMiddleware } from '../getAccessControlMiddleware.ts';

function respond(url: string, respondWith: (res: ServerResponse) => void, method = 'GET') {
  const req = { url, method } as IncomingMessage;
  const res = new ServerResponse(req);
  getAccessControlMiddleware(false)(req, res, vi.fn());
  respondWith(res);
  return res.getHeader('Access-Control-Allow-Origin');
}

const asFont = (res: ServerResponse) => res.writeHead(200, { 'Content-Type': 'font/woff2' });

describe('getAccessControlMiddleware', () => {
  it.each(['/fonts/inter.woff2', '/fonts/inter.WOFF?v=2', '/assets/icons.ttf'])(
    'lets any origin read the font served at %s',
    (url) => {
      expect(respond(url, asFont)).toBe('*');
      expect(
        respond(url, (res) => {
          res.setHeader('content-type', 'font/woff2');
          res.end();
        })
      ).toBe('*');
    }
  );

  it('keeps a route that answers a font-looking path with other content unreadable', () => {
    expect(
      respond('/project.json/x.woff2', (res) =>
        res.writeHead(200, { 'Content-Type': 'application/json' })
      )
    ).toBeUndefined();
    expect(respond('/missing.woff2', (res) => res.writeHead(404))).toBeUndefined();
  });

  it('does not treat a font extension in the query as a font', () => {
    expect(respond('/src/secret.ts?file=.woff2', asFont)).toBeUndefined();
  });

  it('only opens fonts to reads', () => {
    expect(respond('/fonts/inter.woff2', asFont, 'POST')).toBeUndefined();
  });
});
