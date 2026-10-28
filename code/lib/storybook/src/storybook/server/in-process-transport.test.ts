import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { createInProcessTransport, type InProcessRequest } from './in-process-transport.ts';

/** Route by path, like a tiny app, so each case reads as request → response. */
async function app(req: IncomingMessage, res: ServerResponse): Promise<void> {
  switch (req.url) {
    case '/text':
      res.setHeader('Content-Type', 'text/plain');
      res.end('hello');
      return;
    case '/redirect':
      res.writeHead(302, { Location: '/text' }).end();
      return;
    case '/binary':
      res
        .writeHead(200, { 'Content-Type': 'image/png' })
        .end(Buffer.from([0x89, 0x50, 0x00, 0xff]));
      return;
    case '/stream':
      Readable.from(['a', 'b', 'c']).pipe(res);
      return;
    case '/chunked':
      res.setHeader('Transfer-Encoding', 'chunked');
      res.write('one,');
      res.end('two');
      return;
    case '/echo': {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }
      res.end(`${req.method} ${req.headers['content-type']} ${body}`);
      return;
    }
    default:
      res.statusCode = 404;
      res.end('missing');
  }
}

const CASES: Array<{ name: string; input: InProcessRequest }> = [
  { name: 'text', input: { method: 'GET', url: '/text', headers: {} } },
  { name: 'HEAD drops the body', input: { method: 'HEAD', url: '/text', headers: {} } },
  { name: 'redirect', input: { method: 'GET', url: '/redirect', headers: {} } },
  { name: 'binary', input: { method: 'GET', url: '/binary', headers: {} } },
  { name: 'piped stream', input: { method: 'GET', url: '/stream', headers: {} } },
  { name: 'explicit chunked', input: { method: 'GET', url: '/chunked', headers: {} } },
  {
    name: 'request body',
    input: {
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      body: Buffer.from('{"a":1}'),
    },
  },
  { name: 'not found', input: { method: 'GET', url: '/nope', headers: {} } },
];

describe('createInProcessTransport', () => {
  it('answers each request with the full response the listener wrote', async () => {
    const transport = createInProcessTransport(app);
    const responses = await Promise.all(
      CASES.map(async ({ name, input }) => {
        const { status, headers, body } = await transport.dispatch(input);
        const { date: _date, ...stableHeaders } = headers;
        const binary = headers['content-type'] === 'image/png';
        return [
          name,
          { status, headers: stableHeaders, body: body.toString(binary ? 'hex' : 'utf8') },
        ];
      })
    );
    expect(Object.fromEntries(responses)).toMatchInlineSnapshot(`
      {
        "HEAD drops the body": {
          "body": "",
          "headers": {
            "content-type": "text/plain",
          },
          "status": 200,
        },
        "binary": {
          "body": "895000ff",
          "headers": {
            "content-type": "image/png",
          },
          "status": 200,
        },
        "explicit chunked": {
          "body": "one,two",
          "headers": {},
          "status": 200,
        },
        "not found": {
          "body": "missing",
          "headers": {},
          "status": 404,
        },
        "piped stream": {
          "body": "abc",
          "headers": {},
          "status": 200,
        },
        "redirect": {
          "body": "",
          "headers": {
            "location": "/text",
          },
          "status": 302,
        },
        "request body": {
          "body": "POST application/json {"a":1}",
          "headers": {},
          "status": 200,
        },
        "text": {
          "body": "hello",
          "headers": {
            "content-type": "text/plain",
          },
          "status": 200,
        },
      }
    `);
  });

  it('fails requests still open on close', async () => {
    const transport = createInProcessTransport((_req, res) => res.write('event: ping\n\n'));
    const pending = transport.dispatch({ method: 'GET', url: '/events', headers: {} });
    transport.close();
    await expect(pending).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: In-process request was aborted: GET /events]`
    );
  });
});
