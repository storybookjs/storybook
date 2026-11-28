import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { HttpTransport } from '@tmcp/transport-http';
import pkgJson from '../package.json' with { type: 'json' };
import type { Source } from 'storybook/internal/toolsets-docs';
import type { Options } from 'storybook/internal/types';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buffer } from 'node:stream/consumers';
import { collectTelemetry } from './telemetry.ts';
import type { DocsAccess } from 'storybook/internal/toolsets-docs';
import type { AddonContext } from './types.ts';
import { getEffectiveToolAvailability, getToolAvailability } from 'storybook/internal/core-server';
import { buildServerInstructions } from 'storybook/internal/skills';
import type { CompositionAuth } from './auth/index.ts';
import { DEFAULT_MCP_ENDPOINT } from './constants.ts';
import { registerAddonMcpTools } from './tools/tool-registry.ts';
import { toBaseUrl } from './utils/base-url.ts';

let transport: HttpTransport<AddonContext> | undefined;
// Promise that ensures single initialization, even with concurrent requests
let initialize: Promise<McpServer<any, AddonContext>> | undefined;
let disableTelemetry: boolean | undefined;
let a11yEnabled: boolean | undefined;

const initializeMCPServer = async (options: Options, multiSource?: boolean) => {
  const core = await options.presets.apply('core', {});
  disableTelemetry = core?.disableTelemetry ?? false;

  // Determine tool availability before creating server so instructions can be tailored.
  // Shares one source of truth with the browser landing page (core's `getToolAvailability`)
  // so the registered tools and the page's enabled/disabled badges can't drift.
  const rawAvailability = await getToolAvailability(options);
  const availability = getEffectiveToolAvailability(rawAvailability, { multiSource });
  a11yEnabled = availability.a11yEnabled;

  const serverOptions = {
    adapter: new ValibotJsonSchemaAdapter(),
    instructions: buildServerInstructions({
      testSupported: availability.testSupported,
      docsEnabled: availability.docsEnabled,
    }),
    // Storybook sends no list-changed notifications, and the handler below buffers each response
    // before it sends it, so a stream that waits for them never gets an answer. A client that
    // opens one because the server announces them (Claude Code) waits out its own time limit.
    capabilities: {
      tools: { listChanged: false },
      resources: { listChanged: false },
    },
  };

  const server = new McpServer(
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

  transport = new HttpTransport(server, { path: null, allowedOrigins: true });

  return server;
};

/**
 * Vite middleware handler that wraps the MCP handler.
 * This converts Node.js IncomingMessage/ServerResponse to Web API Request/Response.
 */
type McpServerHandlerParams = {
  req: IncomingMessage;
  res: ServerResponse;
  options: Options;
  /** Origin of the local Storybook, e.g. `http://localhost:6006`. */
  origin: string;
  /** URL path prefix the local Storybook is served from, `/` or `/seg/`. */
  basePath: string;
  /**
   * The MCP endpoint path (e.g. `/mcp` or a user-configured override).
   * Used to derive the Storybook root from the incoming request URL inside
   * tools like `review-create`. Optional for backwards compatibility with
   * external callers; defaults to {@link DEFAULT_MCP_ENDPOINT}.
   */
  endpoint?: string;
  /** Sources for multi-source mode (when refs are configured) */
  sources?: Source[];
  /** Whether to register the composition tools; defaults to whether `sources` has a remote one */
  multiSource?: boolean;
  /** Optional custom manifest provider, receives source as third param in multi-source mode */
  manifestProvider?: (
    request: Request | undefined,
    path: string,
    source?: Source
  ) => Promise<string>;
  /**
   * Optional in-process single-entry resolver for `docgenServer` mode.
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
  origin,
  basePath,
  endpoint = DEFAULT_MCP_ENDPOINT,
  sources,
  multiSource = sources?.some((s) => s.url),
  manifestProvider,
  localAccess,
  compositionAuth,
}: McpServerHandlerParams) => {
  // Initialize MCP server and transport on first request, with concurrency safety
  if (!initialize) {
    initialize = initializeMCPServer(options, multiSource);
  }
  await initialize;

  // Convert Node.js request to Web API Request
  const webRequest = await incomingMessageToWebRequest(req);

  const addonContext: AddonContext = {
    options,
    endpoint,
    origin,
    basePath,
    disableTelemetry: disableTelemetry!,
    a11yEnabled,
    request: webRequest,
    sources,
    manifestProvider,
    localAccess,
  };

  const response = await transport!.respond(webRequest, addonContext);
  if (response) {
    // Buffer body first — tool execution happens lazily during stream consumption
    // (tmcp's transport fires handle() without awaiting it). Only after the body
    // is fully consumed can we check whether a tool hit an auth error.
    const body = await response.arrayBuffer();

    const finalResponse = compositionAuth.hadAuthError(webRequest)
      ? new Response('401 - Unauthorized', {
          status: 401,
          headers: {
            'Content-Type': 'text/plain',
            'WWW-Authenticate': compositionAuth.buildWwwAuthenticate(toBaseUrl(origin, basePath)),
          },
        })
      : new Response(body, { status: response.status, headers: response.headers });

    await webResponseToServerResponse(finalResponse, res);
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
 * Converts a Web Response to a Node.js ServerResponse.
 */
export async function webResponseToServerResponse(
  webResponse: Response,
  nodeResponse: ServerResponse
): Promise<void> {
  nodeResponse.statusCode = webResponse.status;

  // Copy headers
  webResponse.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });

  // Stream response body
  if (webResponse.body) {
    const reader = webResponse.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        nodeResponse.write(value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  nodeResponse.end();
}
