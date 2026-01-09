import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { HttpTransport } from '@tmcp/transport-http';
import pkgJson from '../package.json' with { type: 'json' };
import { addListAllDocumentationTool } from './tools/list-all-documentation.ts';
import { addGetComponentStoryDocumentationTool } from './tools/get-documentation-for-story.ts';
import { addGetDocumentationTool } from './tools/get-documentation.ts';
import type { StorybookContext } from './types.ts';

// Export tools for reuse by addon-mcp
export {
	addListAllDocumentationTool,
	LIST_TOOL_NAME,
} from './tools/list-all-documentation.ts';
export {
	addGetDocumentationTool,
	GET_TOOL_NAME,
} from './tools/get-documentation.ts';
export {
	addGetComponentStoryDocumentationTool,
	GET_STORY_TOOL_NAME,
} from './tools/get-documentation-for-story.ts';

// Export manifest constants
export {
	COMPONENT_MANIFEST_PATH,
	DOCS_MANIFEST_PATH,
} from './utils/get-manifest.ts';

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
			name: pkgJson.name,
			version: pkgJson.version,
			description: pkgJson.description,
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

	await addListAllDocumentationTool(server);
	await addGetComponentStoryDocumentationTool(server);
	await addGetDocumentationTool(server);

	const transport = new HttpTransport(server, { path: null });

	return (async (req, context) => {
		return await transport.respond(req, {
			request: req,
			format: context?.format ?? options.format ?? 'markdown',
			manifestProvider: context?.manifestProvider ?? options.manifestProvider,
			onListAllDocumentation:
				context?.onListAllDocumentation ?? options.onListAllDocumentation,
			onGetDocumentation:
				context?.onGetDocumentation ?? options.onGetDocumentation,
		});
	}) as Handler;
};
