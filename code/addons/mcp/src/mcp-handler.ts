import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { HttpTransport } from '@tmcp/transport-http';
import pkgJson from '../package.json' with { type: 'json' };
import type { Source } from '@storybook/core/internal/toolsets-docs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buffer } from 'node:stream/consumers';
import { collectTelemetry } from './telemetry.ts';
import type { DocsAccess } from '@storybook/core/internal/toolsets-docs';
import type { AddonContext, AddonOptionsOutput, McpServerOptions } from './types.ts';
import { logger } from '@storybook/core/internal/node-logger';
import { getEffectiveToolAvailability, getToolAvailability } from 'storybook/internal/server';
import { buildServerInstructions } from 'storybook/internal/skills';
import type { CompositionAuth } from './auth/index.ts';
import { DEFAULT_MCP_ENDPOINT } from './constants.ts';
import { registerAddonMcpTools } from './tools/tool-registry.ts';

/** One Storybook's MCP server, created on its first request. */
export interface McpServerState {
  /** Shared by concurrent first requests, so the server initializes once. */
  initialize?: Promise<InitializedMcpServer>;
}

type McpHandlerOptions = McpServerOptions;

type InitializedMcpServer = {
  transport: HttpTransport<AddonContext>;
  origin: string;
  disableTelemetry: boolean;
  a11yEnabled: boolean | undefined;
};

/** Creates the MCP server state of one Storybook; each mounted endpoint owns one. */
export function createMcpServerState(): McpServerState {
  return {};
}

const initializeMCPServer = async (
  options: McpHandlerOptions,
  multiSource?: boolean
): Promise<InitializedMcpServer> => {
  const disableTelemetry = options.core?.disableTelemetry ?? false;

  // Determine tool availability before creating server so instructions can be tailored.
  // Shares one source of truth with the browser landing page (core's `getToolAvailability`)
  // so the registered tools and the page's enabled/disabled badges can't drift.
  const rawAvailability = await getToolAvailability(options.storybook);
  const availability = getEffectiveToolAvailability(rawAvailability, { multiSource });

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
        moduleGraphSupported: availability.moduleGraphSupported,
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

  const transport = new HttpTransport(server, { path: null });

  const origin = `http://localhost:${options.storybook.options.port}`;
  logger.debug(`MCP server origin: ${origin}`);
  return { transport, origin, disableTelemetry, a11yEnabled: availability.a11yEnabled };
};

/**
 * Vite middleware handler that wraps the MCP handler.
 * This converts Node.js IncomingMessage/ServerResponse to Web API Request/Response.
 */
type McpServerHandlerParams = {
  req: IncomingMessage;
  res: ServerResponse;
  options: McpHandlerOptions;
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
   * Optional in-process single-entry resolver for `docgenServer` mode.
   * Selected (alongside `manifestProvider`) by the caller; the doc tools only consult
   * it for the local source. Undefined on older Storybook versions / when the feature is off.
   */
  localAccess?: DocsAccess;
  /** Composition auth handler for multi-source mode */
  compositionAuth: CompositionAuth;
  /** The MCP server of the Storybook serving this endpoint. */
  server: McpServerState;
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
  server,
}: McpServerHandlerParams): Promise<void> => {
  server.initialize ??= initializeMCPServer(
    options,
    sources?.some((s) => s.url)
  );
  const { transport, origin, disableTelemetry, a11yEnabled } = await server.initialize;

  // Convert Node.js request to Web API Request
  const webRequest = await incomingMessageToWebRequest(req);

  const addonContext: AddonContext = {
    storybook: options.storybook,
    endpoint,
    toolsets: getToolsets(webRequest, addonOptions),
    origin,
    disableTelemetry,
    a11yEnabled,
    request: webRequest,
    sources,
    manifestProvider,
    localAccess,
  };

  const response = await transport.respond(webRequest, addonContext);
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
            'WWW-Authenticate': compositionAuth.buildWwwAuthenticate(origin),
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
