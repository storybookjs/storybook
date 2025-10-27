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
export type { ComponentManifest, ComponentManifestMap } from './types.ts';

type Handler = (req: Request, context?: StorybookContext) => Promise<Response>;

export const createStorybookMcpHandler = async (
	options: StorybookContext = {},
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
