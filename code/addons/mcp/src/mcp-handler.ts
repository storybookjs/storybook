import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { HttpTransport } from '@tmcp/transport-http';
import pkgJson from '../package.json' with { type: 'json' };
import type { Source } from 'storybook/internal/toolsets-docs';
import type { Options } from 'storybook/internal/types';
import type { IncomingMessage } from 'node:http';
import { buffer } from 'node:stream/consumers';
import { collectTelemetry } from './telemetry.ts';
import type { DocsAccess } from 'storybook/internal/toolsets-docs';
import type { AddonContext, AddonOptionsOutput } from './types.ts';
import { logger } from 'storybook/internal/node-logger';
import { getEffectiveToolAvailability, getToolAvailability } from 'storybook/internal/core-server';
import { buildServerInstructions } from 'storybook/internal/skills';
import type { CompositionAuth } from './auth/index.ts';
import { DEFAULT_MCP_ENDPOINT, STORYBOOK_MCP_PROXY_HEADER } from './constants.ts';
import { registerAddonMcpTools } from './tools/tool-registry.ts';

let transport: HttpTransport<AddonContext> | undefined;
let origin: string | undefined;
// Promise that ensures single initialization, even with concurrent requests
let initialize: Promise<McpServer<any, AddonContext>> | undefined;
let disableTelemetry: boolean | undefined;
let a11yEnabled: boolean | undefined;
let reviewGates: { reviewEnabled: boolean; reviewEnabledForCli: boolean } | undefined;

const initializeMCPServer = async (options: Options, multiSource?: boolean) => {
  const core = await options.presets.apply('core', {});
  const features = await options.presets.apply('features', {});
  disableTelemetry = core?.disableTelemetry ?? false;

  // Determine tool availability before creating server so instructions can be tailored.
  // Shares one source of truth with the browser landing page (core's `getToolAvailability`)
  // so the registered tools and the page's enabled/disabled badges can't drift. Reuse the
  // already-resolved `features` so it doesn't re-apply the preset and risk a different snapshot.
  const rawAvailability = await getToolAvailability(options, { features });
  const availability = getEffectiveToolAvailability(rawAvailability, { multiSource });
  a11yEnabled = availability.a11yEnabled;
  reviewGates = {
    reviewEnabled: availability.reviewEnabled,
    reviewEnabledForCli: availability.reviewEnabledForCli,
  };

  // oxlint-disable-next-line prefer-const -- the instructions getter below may run before this is assigned
  let server: McpServer<any, AddonContext>;

  const serverOptions = {
    adapter: new ValibotJsonSchemaAdapter(),
    get instructions() {
      return buildServerInstructions({
        transport: 'mcp',
        devEnabled: server?.ctx.custom?.toolsets?.dev ?? true,
        testSupported: (server?.ctx.custom?.toolsets?.test ?? true) && availability.testSupported,
        docsEnabled: (server?.ctx.custom?.toolsets?.docs ?? true) && availability.docsEnabled,
        changeDetectionEnabled: availability.changeDetectionEnabled,
        moduleGraphSupported: availability.moduleGraphSupported,
        reviewEnabled: server?.ctx.custom?.reviewEnabled ?? availability.reviewEnabled,
      });
    },
    capabilities: {
      tools: { listChanged: true },
      resources: { listChanged: true },
    },
  };

  server = new McpServer(
    {
      name: pkgJson.name,
      version: pkgJson.version,
      description: pkgJson.description,
    },
    serverOptions
  ).withContext<AddonContext>();

  if (!disableTelemetry) {
    server.on('initialize', async () => {
      await collectTelemetry({ event: 'session:initialized', server });
    });
  }

  await registerAddonMcpTools(server, { availability, multiSource });

  transport = new HttpTransport(server, { path: null });

  origin = `http://localhost:${options.port}`;
  logger.debug(`MCP server origin: ${origin}`);
  return server;
};

/**
 * The pieces of a Node response the bridging below touches. A real `ServerResponse` satisfies it,
 * so a caller (including a test) can supply its own response without claiming to be the class.
 */
type ClientAwareResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  write(chunk: Uint8Array): boolean;
  end(): void;
  once(event: 'close' | 'drain', listener: () => void): unknown;
  off(event: 'close' | 'drain', listener: () => void): unknown;
};

/**
 * Vite middleware handler that wraps the MCP handler.
 * This converts Node.js IncomingMessage/ServerResponse to Web API Request/Response.
 */
type McpServerHandlerParams = {
  req: IncomingMessage;
  res: ClientAwareResponse;
  options: Options;
  addonOptions: AddonOptionsOutput;
  /**
   * The MCP endpoint path (e.g. `/mcp` or a user-configured override).
   * Used to derive the Storybook root from the incoming request URL inside
   * tools like `review-create`. Optional for backwards compatibility with
   * external callers; defaults to {@link DEFAULT_MCP_ENDPOINT}.
   */
  endpoint?: string;
  /** Sources for multi-source mode (when refs are configured) */
  sources?: Source[];
  /** Optional custom manifest provider, receives source as third param in multi-source mode */
  manifestProvider?: (
    request: Request | undefined,
    path: string,
    source?: Source
  ) => Promise<string>;
  /**
   * Optional in-process single-entry resolver for `experimentalDocgenServer` mode.
   * Selected (alongside `manifestProvider`) by the caller; the doc tools only consult
   * it for the local source. Undefined on older Storybook versions / when the feature is off.
   */
  localAccess?: DocsAccess;
  /** Composition auth handler for multi-source mode */
  compositionAuth: CompositionAuth;
};

export const mcpServerHandler = async ({
  req,
  res,
  options,
  addonOptions,
  endpoint = DEFAULT_MCP_ENDPOINT,
  sources,
  manifestProvider,
  localAccess,
  compositionAuth,
}: McpServerHandlerParams) => {
  // The client can leave while the server is still booting, so this listener goes on before the
  // first awaited setup step. A close that arrives during that setup would otherwise be missed,
  // and the GET channel the transport then hands back would be abandoned with its session still
  // registered.
  const clientGone = abortWhenClientLeaves(res);
  try {
    // Initialize MCP server and transport on first request, with concurrency safety
    if (!initialize) {
      initialize = initializeMCPServer(
        options,
        sources?.some((s) => s.url)
      );
    }
    await initialize;

    if (clientGone.signal.aborted) {
      return;
    }

    // Convert Node.js request to Web API Request
    const webRequest = await incomingMessageToWebRequest(req);

    const addonContext: AddonContext = {
      options,
      endpoint,
      toolsets: getToolsets(webRequest, addonOptions),
      reviewEnabled: isReviewEnabledForRequest(webRequest, reviewGates!),
      cliClient: webRequest.headers.get(STORYBOOK_MCP_PROXY_HEADER) === 'true',
      origin: origin!,
      disableTelemetry: disableTelemetry!,
      a11yEnabled,
      request: webRequest,
      sources,
      manifestProvider,
      localAccess,
    };

    const response = await transport!.respond(webRequest, addonContext);
    if (!response) {
      return;
    }

    // The GET response is the session's notification channel, which ends only when the client
    // leaves, so the buffering below would never answer it.
    if (webRequest.method !== 'POST') {
      await webResponseToServerResponse(response, res, clientGone.signal);
      return;
    }

    // Buffer body first — tool execution happens lazily during stream consumption
    // (tmcp's transport fires handle() without awaiting it). Only after the body
    // is fully consumed can we check whether a tool hit an auth error.
    const body = await response.arrayBuffer();

    const finalResponse = compositionAuth.hadAuthError(webRequest)
      ? new Response('401 - Unauthorized', {
          status: 401,
          headers: {
            'Content-Type': 'text/plain',
            'WWW-Authenticate': compositionAuth.buildWwwAuthenticate(origin!),
          },
        })
      : new Response(body, { status: response.status, headers: response.headers });

    await webResponseToServerResponse(finalResponse, res, clientGone.signal);
  } finally {
    clientGone.dispose();
  }
};

/**
 * Converts a Node.js IncomingMessage to a Web Request.
 */
export async function incomingMessageToWebRequest(req: IncomingMessage): Promise<Request> {
  // Construct URL from request, using host header if available for accuracy
  const host = req.headers.host || 'localhost';
  const protocol = 'encrypted' in req.socket && req.socket.encrypted ? 'https' : 'http';
  const url = new URL(req.url || '/', `${protocol}://${host}`);

  const bodyBuffer = await buffer(req);

  return new Request(url, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body: bodyBuffer.length > 0 ? new Uint8Array(bodyBuffer) : undefined,
  });
}

/**
 * Bridges the Node response's lifecycle to an {@link AbortSignal}, so a client that leaves can be
 * noticed from wherever it matters without every layer attaching its own listener.
 */
export function abortWhenClientLeaves(nodeResponse: ClientAwareResponse) {
  const controller = new AbortController();
  const leave = () => controller.abort();
  nodeResponse.once('close', leave);
  return {
    signal: controller.signal,
    dispose: () => {
      nodeResponse.off('close', leave);
    },
  };
}

/**
 * Resolves once Node accepts another chunk. A client that left never emits `drain`, so the signal
 * ends the wait instead of parking the stream forever.
 */
function waitForDrain(nodeResponse: ClientAwareResponse, clientGone: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (clientGone.aborted) {
      resolve();
      return;
    }
    const drained = () => {
      clientGone.removeEventListener('abort', left);
      resolve();
    };
    const left = () => {
      nodeResponse.off('drain', drained);
      resolve();
    };
    nodeResponse.once('drain', drained);
    clientGone.addEventListener('abort', left, { once: true });
  });
}

/**
 * Converts a Web Response to a Node.js ServerResponse.
 */
export async function webResponseToServerResponse(
  webResponse: Response,
  nodeResponse: ClientAwareResponse,
  clientGone: AbortSignal
): Promise<void> {
  nodeResponse.statusCode = webResponse.status;

  // Copy headers
  webResponse.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });

  // Stream response body
  if (webResponse.body) {
    const reader = webResponse.body.getReader();
    // Cancelling is what runs the transport's stream `cancel()` hook, which unregisters the
    // session; an abandoned channel that stays registered makes the client's next GET for the same
    // session id fail with "Conflict: Only one SSE stream is allowed per session".
    let released: Promise<void> | undefined;
    const release = () => {
      released ??= reader.cancel().catch(() => {
        // the stream was already closed or errored, so there is nothing left to release
      });
    };
    // An already-aborted signal never fires its listener, so release here rather than park in read().
    if (clientGone.aborted) {
      release();
    }
    clientGone.addEventListener('abort', release, { once: true });
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!nodeResponse.write(value)) {
          await waitForDrain(nodeResponse, clientGone);
        }
      }
      // The transport unregisters the session inside the cancel hook, so a client that reconnects
      // under the same session id has to be answered after that hook settles.
      await released;
    } finally {
      clientGone.removeEventListener('abort', release);
      reader.releaseLock();
    }
  }

  nodeResponse.end();
}

/**
 * Review is on for a request when the `experimentalReview` flag enables it
 * globally, or when the request marks itself as coming from the `storybook ai`
 * CLI (the Claude/Codex plugins) via {@link STORYBOOK_MCP_PROXY_HEADER} —
 * that channel gets review by default, direct MCP clients stay opt-in.
 */
export function isReviewEnabledForRequest(
  request: Request,
  gates: { reviewEnabled: boolean; reviewEnabledForCli: boolean }
): boolean {
  return (
    gates.reviewEnabled ||
    (gates.reviewEnabledForCli && request.headers.get(STORYBOOK_MCP_PROXY_HEADER) === 'true')
  );
}

export function getToolsets(
  request: Request,
  addonOptions: AddonOptionsOutput
): AddonOptionsOutput['toolsets'] {
  const toolsetHeader = request.headers.get('X-MCP-Toolsets');
  if (!toolsetHeader || toolsetHeader.trim() === '') {
    // If no header is present, return the addon options as-is
    return addonOptions.toolsets;
  }

  // If the toolsets headers are present, default to everything being disabled
  // except for the ones explicitly enabled in the header
  const toolsets: AddonOptionsOutput['toolsets'] = {
    dev: false,
    docs: false,
    test: false,
  };

  // The format of the header is a comma-separated list of enabled toolsets
  // e.g., "dev,docs"
  const enabledToolsets = toolsetHeader.split(',');

  for (const enabledToolset of enabledToolsets) {
    const trimmedToolset = enabledToolset.trim();
    if (trimmedToolset in toolsets) {
      toolsets[trimmedToolset as keyof typeof toolsets] = true;
    }
  }
  return toolsets;
}
