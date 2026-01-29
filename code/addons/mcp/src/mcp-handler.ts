import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { HttpTransport } from '@tmcp/transport-http';
import pkgJson from '../package.json' with { type: 'json' };
import { addPreviewStoriesTool } from './tools/preview-stories.ts';
import { addGetUIBuildingInstructionsTool } from './tools/get-storybook-story-instructions.ts';
import { addListAllDocumentationTool, addGetDocumentationTool } from '@storybook/mcp';
import type { Options } from 'storybook/internal/types';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buffer } from 'node:stream/consumers';
import { collectTelemetry } from './telemetry.ts';
import type { AddonContext, AddonOptionsOutput } from './types.ts';
import { logger } from 'storybook/internal/node-logger';
import { getManifestStatus } from './tools/is-manifest-available.ts';
import { estimateTokens } from './utils/estimate-tokens.ts';

let transport: HttpTransport<AddonContext> | undefined;
let origin: string | undefined;
// Promise that ensures single initialization, even with concurrent requests
let initialize: Promise<McpServer<any, AddonContext>> | undefined;
let disableTelemetry: boolean | undefined;

const initializeMCPServer = async (options: Options) => {
	const core = await options.presets.apply('core', {});
	disableTelemetry = core?.disableTelemetry ?? false;

	const server = new McpServer(
		{
			name: pkgJson.name,
			version: pkgJson.version,
			description: pkgJson.description,
		},
		{
			adapter: new ValibotJsonSchemaAdapter(),
			capabilities: {
				tools: { listChanged: true },
				resources: { listChanged: true },
			},
		},
	).withContext<AddonContext>();

	if (!disableTelemetry) {
		server.on('initialize', async () => {
			await collectTelemetry({ event: 'session:initialized', server });
		});
	}

	// Register dev addon tools
	await addPreviewStoriesTool(server);
	await addGetUIBuildingInstructionsTool(server);

	// Only register the additional tools if the component manifest feature is enabled
	const manifestStatus = await getManifestStatus(options);
	if (manifestStatus.available) {
		logger.info('Experimental components manifest feature detected - registering component tools');
		const contextAwareEnabled = () => server.ctx.custom?.toolsets?.docs ?? true;
		await addListAllDocumentationTool(server, contextAwareEnabled);
		await addGetDocumentationTool(server, contextAwareEnabled);
	}

	transport = new HttpTransport(server, { path: null });

	origin = `http://localhost:${options.port}`;
	logger.debug(`MCP server origin: ${origin}`);
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
	addonOptions: AddonOptionsOutput;
};

export const mcpServerHandler = async ({
	req,
	res,
	options,
	addonOptions,
}: McpServerHandlerParams) => {
	// Initialize MCP server and transport on first request, with concurrency safety
	if (!initialize) {
		initialize = initializeMCPServer(options);
	}
	const server = await initialize;

	// Convert Node.js request to Web API Request
	const webRequest = await incomingMessageToWebRequest(req);

	const addonContext: AddonContext = {
		options,
		toolsets: getToolsets(webRequest, addonOptions),
		format: addonOptions.experimentalFormat,
		origin: origin!,
		disableTelemetry: disableTelemetry!,
		request: webRequest,
		// Telemetry handlers for component manifest tools
		...(!disableTelemetry && {
			onListAllDocumentation: async ({ manifests, resultText }) => {
				await collectTelemetry({
					event: 'tool:listAllDocumentation',
					server,
					toolset: 'docs',
					componentCount: Object.keys(manifests.componentManifest.components).length,
					docsCount: Object.keys(manifests.docsManifest?.docs || {}).length,
					resultTokenCount: estimateTokens(resultText),
				});
			},
			onGetDocumentation: async ({ input, foundDocumentation, resultText }) => {
				await collectTelemetry({
					event: 'tool:getDocumentation',
					server,
					toolset: 'docs',
					componentId: input.id,
					found: !!foundDocumentation,
					resultTokenCount: estimateTokens(resultText ?? ''),
				});
			},
		}),
	};

	const response = await transport!.respond(webRequest, addonContext);

	// Convert Web API Response to Node.js response
	if (response) {
		await webResponseToServerResponse(response, res);
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
		// oxlint-disable-next-line no-invalid-fetch-options -- We know req.method is always 'POST', linter doesn't
		body: bodyBuffer.length > 0 ? new Uint8Array(bodyBuffer) : undefined,
	});
}

/**
 * Converts a Web Response to a Node.js ServerResponse.
 */
export async function webResponseToServerResponse(
	webResponse: Response,
	nodeResponse: ServerResponse,
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
	addonOptions: AddonOptionsOutput,
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
