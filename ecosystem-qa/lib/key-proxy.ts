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

// The only calls an agent run needs from the provider. Anything else, a files upload for example,
// would let the sandbox use the key for more than the run.
const FORWARDED = new Set(['POST /v1/messages', 'POST /v1/messages/count_tokens']);

// What the sandbox gets as its key. It must not look like a key, so the redaction of the run
// record leaves it alone and a leak search finds only the real one.
export const PLACEHOLDER_KEY = 'key-proxy-adds-the-real-key';

export interface KeyProxyOptions {
  // The address to listen on, the gateway of the sandbox's network.
  host: string;
  // The one address a request may come from, the sandbox container's.
  caller: string;
  // The provider, as an origin such as `https://api.anthropic.com`.
  upstream: string;
  apiKey: string;
  log: (line: string) => void;
}

export interface KeyProxy {
  server: Server;
  // What the agent gets as its base URL.
  url: string;
}

// Forward the agent's requests to the provider with the real key in place of the placeholder.
export const startKeyProxy = async (options: KeyProxyOptions): Promise<KeyProxy> => {
  const upstream = new URL(options.upstream);
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
    if (req.socket.remoteAddress !== options.caller) {
      respond(403).end();
      return;
    }
    if (!target || !FORWARDED.has(`${req.method} ${pathname}`)) {
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
  return { server, url: `http://${options.host}:${port}` };
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

// The gateway and the container's address on its one network, from `docker inspect <container>`.
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
