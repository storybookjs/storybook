import {
  createServer,
  request as httpRequest,
  type IncomingHttpHeaders,
  type Server,
} from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { AddressInfo } from 'node:net';
import { pipeline } from 'node:stream';

import { z } from 'zod';

const AGENT_RUN_CALLS = new Set(['POST /v1/messages', 'POST /v1/messages/count_tokens']);

export const PLACEHOLDER_KEY = 'key-proxy-adds-the-real-key';

export interface KeyProxyOptions {
  host: string;
  callerAddress: string;
  upstreamOrigin: string;
  apiKey: string;
  log: (line: string) => void;
}

export interface KeyProxy {
  server: Server;
  baseUrl: string;
}

export const startKeyProxy = async (options: KeyProxyOptions): Promise<KeyProxy> => {
  const upstream = new URL(options.upstreamOrigin);
  const send = upstream.protocol === 'https:' ? httpsRequest : httpRequest;
  const server = createServer((req, res) => {
    // A request line may name a host of its own, as `http://elsewhere/v1/messages` or
    // `//elsewhere/v1/messages`, and resolving it against the provider would send the key there.
    const target = URL.parse(req.url ?? '', upstream.href);
    const pathname = target?.origin === upstream.origin ? target.pathname : '(not the provider)';
    const respond = (status: number, headers?: IncomingHttpHeaders) => {
      options.log(`Key proxy: ${req.method} ${pathname} ${status}`);
      return res.writeHead(status, headers);
    };
    if (req.socket.remoteAddress !== options.callerAddress) {
      respond(403).end();
      return;
    }
    if (!target || !AGENT_RUN_CALLS.has(`${req.method} ${pathname}`)) {
      respond(404).end();
      return;
    }
    const headers = { ...req.headers, 'x-api-key': options.apiKey };
    delete headers.host;
    delete headers.authorization;
    const forwarded = send(target, { method: req.method, headers }, (reply) => {
      respond(reply.statusCode ?? 502, reply.headers);
      // Unlike `pipe`, this breaks off the caller's answer when the provider breaks off its own.
      pipeline(reply, res, () => {});
    });
    forwarded.on('error', () => {
      if (!res.headersSent) {
        respond(502);
      }
      res.end();
    });
    res.on('close', () => {
      if (!res.writableFinished) {
        forwarded.destroy();
      }
    });
    req.pipe(forwarded);
  });
  await new Promise<void>((listening, failed) => {
    server.once('error', failed);
    server.listen(0, options.host, listening);
  });
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://${options.host}:${port}` };
};

const Inspected = z
  .array(
    z.object({
      NetworkSettings: z.object({
        Networks: z.record(z.string(), z.object({ Gateway: z.string(), IPAddress: z.string() })),
      }),
    })
  )
  .length(1);

export const sandboxAddresses = (inspectJson: string): { gateway: string; container: string } => {
  const [container] = Inspected.parse(JSON.parse(inspectJson));
  const networks = Object.values(container!.NetworkSettings.Networks);
  const [network] = networks;
  if (networks.length !== 1 || !network?.Gateway || !network.IPAddress) {
    throw new Error(
      `The sandbox has ${networks.length} networks, and the key proxy needs it on exactly one with an address.`
    );
  }
  return { gateway: network.Gateway, container: network.IPAddress };
};
