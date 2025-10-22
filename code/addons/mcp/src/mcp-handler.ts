import type { Connect } from 'vite';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { HttpTransport } from '@tmcp/transport-http';
import pkgJson from '../package.json' with { type: 'json' };
import { addGetStoryUrlsTool } from './tools/get-story-urls.ts';
import { addGetUIBuildingInstructionsTool } from './tools/get-ui-building-instructions.ts';
import type { Options, CoreConfig } from 'storybook/internal/types';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buffer } from 'node:stream/consumers';
import { collectTelemetry } from './telemetry.ts';
import type { AddonContext } from './types.ts';
import { logger } from 'storybook/internal/node-logger';

let transport: HttpTransport<AddonContext> | undefined;
let origin: string | undefined;

/**
 * Vite middleware handler that wraps the MCP handler.
 * This converts Node.js IncomingMessage/ServerResponse to Web API Request/Response.
 */
export const mcpServerHandler = async (
	req: IncomingMessage,
	res: ServerResponse,
	next: Connect.NextFunction,
	options: Options,
) => {
	const { disableTelemetry = false } = await options.presets.apply<CoreConfig>(
		'core',
		{},
	);

	// Initialize MCP server and transport on first request
	if (!transport || !origin) {
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
				},
			},
		).withContext<AddonContext>();

		if (!disableTelemetry) {
			server.on('initialize', (data) => {
				const sessionId = server.ctx.sessionId;
				const client = server.ctx.custom?.client;

				collectTelemetry({
					event: 'session:initialized',
					sessionId,
					client: client ?? 'unknown',
					clientCapabilities: data.capabilities,
				});
			});
		}

		// Register tools
		await addGetStoryUrlsTool(server);
		await addGetUIBuildingInstructionsTool(server);

		transport = new HttpTransport(server, { path: null });

		origin = `http://localhost:${options.port}`;
		logger.debug('MCP server origin:', origin);
	}

	// Convert Node.js request to Web API Request
	const { webRequest, client } = await incomingMessageToWebRequest(req);

	// Build the addon context
	const addonContext: AddonContext = {
		options,
		origin,
		client,
		disableTelemetry,
	};

	const response = await transport.respond(webRequest, addonContext);

	// Convert Web API Response to Node.js response
	if (response) {
		await webResponseToServerResponse(response, res);
	}
};

/**
 * Converts a Node.js IncomingMessage to a Web Request.
 * Also extracts client info from the request body if it's an initialize request.
 */
async function incomingMessageToWebRequest(
	req: IncomingMessage,
): Promise<{ webRequest: Request; client?: string }> {
	const url = `http://localhost${req.url}`;
	const bodyBuffer = await buffer(req);

	const webRequest = new Request(url, {
		method: req.method,
		headers: req.headers as HeadersInit,
		body: bodyBuffer.length > 0 ? new Uint8Array(bodyBuffer) : undefined,
	});

	if (bodyBuffer.length === 0) {
		return { webRequest };
	}

	// Extract client info if this is an initialize request
	const bodyJson = JSON.parse(bodyBuffer.toString());

	return { webRequest, client: bodyJson.params?.clientInfo?.name };
}

/**
 * Converts a Web Response to a Node.js ServerResponse.
 */
async function webResponseToServerResponse(
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
