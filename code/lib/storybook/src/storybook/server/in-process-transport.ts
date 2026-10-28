import { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { Duplex } from 'node:stream';

/** One request as a browser interception layer reports it. */
export type InProcessRequest = {
  method: string;
  /** Path and query, e.g. `/iframe.html?id=button--primary`. */
  url: string;
  headers: Record<string, string>;
  body?: Buffer;
};

/** The complete response, ready to hand back to the browser. */
export type InProcessResponse = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
};

/** Answer requests by calling a Node request listener directly, without any socket. */
export type InProcessTransport = {
  dispatch(request: InProcessRequest): Promise<InProcessResponse>;
  /** Fail requests still in flight, e.g. never-ending event streams. */
  close(): void;
};

type RequestListener = (req: IncomingMessage, res: ServerResponse) => unknown;

const HOP_BY_HOP_HEADERS = new Set(['connection', 'keep-alive', 'transfer-encoding']);
const HEAD_END = Buffer.from('\r\n\r\n');

/** Run `listener` against in-memory request/response pairs whose raw output is buffered. */
export function createInProcessTransport(listener: RequestListener): InProcessTransport {
  const pending = new Set<Duplex>();

  return {
    dispatch(request) {
      return new Promise<InProcessResponse>((resolve, reject) => {
        const output: Buffer[] = [];
        // A real `ServerResponse` keeps HEAD, 304 and `writeHead` semantics; it only needs a writable socket.
        const socket = new Duplex({
          read() {},
          write(chunk: Buffer, _encoding, callback) {
            output.push(chunk);
            callback();
          },
        });
        Object.assign(socket, { remoteAddress: '127.0.0.1', encrypted: false });
        pending.add(socket);
        socket.once('close', () => {
          pending.delete(socket);
          reject(new Error(`In-process request was aborted: ${request.method} ${request.url}`));
        });

        const req = new IncomingMessage(socket as unknown as Socket);
        Object.assign(req, {
          method: request.method,
          url: request.url,
          httpVersion: '1.1',
          httpVersionMajor: 1,
          httpVersionMinor: 1,
          headers: request.headers,
          rawHeaders: Object.entries(request.headers).flat(),
          complete: true,
        });
        if (request.body?.length) {
          req.push(request.body);
        }
        req.push(null);

        const res = new ServerResponse(req);
        res.useChunkedEncodingByDefault = false;
        res.shouldKeepAlive = false;
        res.assignSocket(socket as unknown as Socket);
        res.once('finish', () => {
          pending.delete(socket);
          try {
            resolve(parseResponse(res.statusCode, Buffer.concat(output)));
          } catch (error) {
            reject(error);
          }
          socket.destroy();
        });

        try {
          listener(req, res);
        } catch (error) {
          pending.delete(socket);
          reject(error);
        }
      });
    },
    close() {
      pending.forEach((socket) => socket.destroy());
      pending.clear();
    },
  };
}

function parseResponse(status: number, raw: Buffer): InProcessResponse {
  const headEnd = raw.indexOf(HEAD_END);
  const head = raw.subarray(0, headEnd).toString('latin1').split('\r\n').slice(1);
  const headers: Record<string, string> = {};
  for (const line of head) {
    const separator = line.indexOf(':');
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    headers[name] = name in headers ? `${headers[name]}, ${value}` : value;
  }
  const rawBody = raw.subarray(headEnd + HEAD_END.length);
  const body = /\bchunked\b/i.test(headers['transfer-encoding'] ?? '')
    ? decodeChunked(rawBody)
    : rawBody;
  for (const name of HOP_BY_HOP_HEADERS) {
    delete headers[name];
  }
  return { status, headers, body };
}

function decodeChunked(raw: Buffer): Buffer {
  const chunks: Buffer[] = [];
  let offset = 0;
  while (offset < raw.length) {
    const lineEnd = raw.indexOf('\r\n', offset);
    const size = Number.parseInt(raw.subarray(offset, lineEnd).toString('latin1'), 16);
    if (!size) {
      break;
    }
    chunks.push(raw.subarray(lineEnd + 2, lineEnd + 2 + size));
    offset = lineEnd + 2 + size + 2;
  }
  return Buffer.concat(chunks);
}
