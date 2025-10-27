import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { HttpTransport } from '@tmcp/transport-http';
import packageJson from '../package.json' with { type: 'json' };
import { addListAllComponentsTool } from './tools/list-all-components.ts';
import { addGetComponentDocumentationTool } from './tools/get-component-documentation.ts';
import type { StorybookContext } from './types.ts';

// Export tools for reuse by addon-mcp
export {
	addListAllComponentsTool,
	LIST_TOOL_NAME,
} from './tools/list-all-components.ts';
export {
	addGetComponentDocumentationTool,
	GET_TOOL_NAME,
} from './tools/get-component-documentation.ts';

// Export types for reuse
export type { StorybookContext } from './types.ts';

// copied from tmcp internals as it's not exposed
type InitializeRequestParams = {
	protocolVersion: string;
	capabilities: {
		experimental?: {} | undefined;
		sampling?: {} | undefined;
		elicitation?: {} | undefined;
		roots?:
			| {
					listChanged?: boolean | undefined;
			  }
			| undefined;
	};
	clientInfo: {
		icons?:
			| {
					src: string;
					mimeType?: string | undefined;
					sizes?: string[] | undefined;
			  }[]
			| undefined;
		version: string;
		websiteUrl?: string | undefined;
		name: string;
		title?: string | undefined;
	};
};

/**
 * Options for creating a Storybook MCP handler.
 * Extends StorybookContext with server-level configuration.
 */
export interface StorybookMcpHandlerOptions extends StorybookContext {
	/**
	 * Optional handler called when an MCP session is initialized.
	 * This is only valid at the handler creation level, not per-request.
	 * Receives the initialize request parameters from the MCP protocol.
	 */
	onSessionInitialize?: (
		initializeRequestParams: InitializeRequestParams,
	) => void | Promise<void>;
}
export type { ComponentManifest, ComponentManifestMap } from './types.ts';

type Handler = (req: Request, context?: StorybookContext) => Promise<Response>;

export const createStorybookMcpHandler = async (
	options: StorybookMcpHandlerOptions = {},
): Promise<Handler> => {
	const adapter = new ValibotJsonSchemaAdapter();
	const server = new McpServer(
		{
			// package.json properties are tree-shaken during build via a rolldown plugin in tsdown.config.ts
			// If we ever changed the used properties here, we would need to update that plugin as well
			name: packageJson.name,
			version: packageJson.version,
			description: packageJson.description,
		},
		{
			adapter,
			capabilities: {
				tools: { listChanged: true },
			},
		},
	).withContext<StorybookContext>();

	if (options.onSessionInitialize) {
		server.on('initialize', options.onSessionInitialize);
	}

	await addListAllComponentsTool(server);
	await addGetComponentDocumentationTool(server);

	const transport = new HttpTransport(server, { path: null });

	return (async (req, context) => {
		return await transport.respond(req, {
			source: context?.source ?? options.source,
			manifestProvider: context?.manifestProvider ?? options.manifestProvider,
			onListAllComponents:
				context?.onListAllComponents ?? options.onListAllComponents,
			onGetComponentDocumentation:
				context?.onGetComponentDocumentation ??
				options.onGetComponentDocumentation,
		});
	}) as Handler;
};
