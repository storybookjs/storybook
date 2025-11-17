/**
 * This is a way to start the @storybook/mcp server as a stdio MCP server, which is sometimes easier for testing.
 * You can run it like this:
 *   node bin.ts --manifestPath ./path/to/manifest.json
 *
 * Or when configuring it as an MCP server:
 * {
 *   "storybook-mcp": {
 *     "type": "stdio",
 *     "command": "node",
 *     "args": ["bin.ts", "--manifestPath", "./path/to/manifest.json"]
 *   }
 * }
 */
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { StdioTransport } from '@tmcp/transport-stdio';
import pkgJson from './package.json' with { type: 'json' };
import { addListAllComponentsTool } from './src/tools/list-all-components.ts';
import { addGetComponentDocumentationTool } from './src/tools/get-component-documentation.ts';
import type { StorybookContext } from './src/types.ts';
import { parseArgs } from 'node:util';
import * as fs from 'node:fs/promises';

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

await addListAllComponentsTool(server);
await addGetComponentDocumentationTool(server);

const transport = new StdioTransport(server);
const args = parseArgs({
	options: {
		manifestPath: {
			type: 'string',
			default: './fixtures/full-manifest.fixture.json',
		},
	},
});

transport.listen({
	source: args.values.manifestPath,
	manifestProvider: async (source) => {
		if (source.startsWith('http://') || source.startsWith('https://')) {
			const res = await fetch(source);
			return await res.text();
		}
		return await fs.readFile(source, 'utf-8');
	},
});
