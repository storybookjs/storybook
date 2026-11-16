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
    let callerLeft = false;
    const forwarded = send(target, { method: req.method, headers }, (reply) => {
      respond(reply.statusCode ?? 502, reply.headers);
      // Unlike `pipe`, this breaks off the caller's answer when the provider breaks off its own.
      pipeline(reply, res, () => {});
    });
    forwarded.on('error', () => {
      if (callerLeft) {
        options.log(`Key proxy: ${req.method} ${pathname} closed by the caller`);
        return;
      }
      if (!res.headersSent) {
        respond(502);
      }
      res.end();
    });
    res.on('close', () => {
      if (!res.writableFinished) {
        callerLeft = true;
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

export interface ProxiedKey {
  agentEnv: { ANTHROPIC_BASE_URL: string; ANTHROPIC_API_KEY: string };
  reaches: (sandboxEnv: string, agent: { env: Record<string, string> }) => boolean;
  close: () => void;
}

export const proxyTheKey = async (
  env: NodeJS.ProcessEnv,
  name: string,
  options: Omit<KeyProxyOptions, 'apiKey'>
): Promise<ProxiedKey> => {
  const apiKey = env[name]!;
  const proxy = await startKeyProxy({ ...options, apiKey }).catch((error: unknown) => {
    throw (error as NodeJS.ErrnoException).code === 'EADDRNOTAVAIL'
      ? new Error(
          `The key proxy cannot listen on ${options.host}, the gateway of Docker's default bridge, because it is not an address of this machine. The Docker daemon runs in a VM, and the key proxy needs one that runs on this machine.`
        )
      : error;
  });
  // Every process started on the host inherits the environment, git in the clone the sandbox wrote
  // to included.
  delete env[name];
  proxy.server.unref();
  return {
    agentEnv: { ANTHROPIC_BASE_URL: proxy.baseUrl, ANTHROPIC_API_KEY: PLACEHOLDER_KEY },
    // Sandcastle exports `agent.env` in front of the agent's own command, so the container's
    // environment never shows it.
    reaches: (sandboxEnv, agent) =>
      [sandboxEnv, ...Object.values(agent.env)].some((text) => text.includes(apiKey)),
    close: () => {
      proxy.server.close();
      proxy.server.closeAllConnections();
    },
  };
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
