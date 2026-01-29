/**
 * This is a way to start the @storybook/mcp server as a stdio MCP server, which is sometimes easier for testing.
 * You can run it like this:
 *   node bin.ts --manifestsDir ./path/to/manifests/dir/ --format markdown
 *
 * Or when configuring it as an MCP server:
 * {
 *   "storybook-mcp": {
 *     "type": "stdio",
 *     "command": "node",
 *     "args": ["bin.ts", "--manifestsDir", "./path/to/manifests/dir/", "--format", "markdown"]
 *   }
 * }
 */
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { StdioTransport } from '@tmcp/transport-stdio';
import pkgJson from './package.json' with { type: 'json' };
import { addListAllDocumentationTool } from './src/tools/list-all-documentation.ts';
import { addGetDocumentationTool } from './src/tools/get-documentation.ts';
import type { StorybookContext, OutputFormat } from './src/types.ts';
import { parseArgs } from 'node:util';
import * as fs from 'node:fs/promises';
import { basename } from 'node:path';

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

await addListAllDocumentationTool(server);
await addGetDocumentationTool(server);

const transport = new StdioTransport(server);
const args = parseArgs({
	options: {
		manifestsDir: {
			type: 'string',
			default: './fixtures/default',
		},
		format: {
			type: 'string',
			default: 'markdown',
		},
	},
});

const format = args.values.format as OutputFormat;

transport.listen({
	format,
	manifestProvider: async (_request, path) => {
		const { manifestsDir } = args.values;
		const fullPath = `${manifestsDir}/${basename(path)}`;

		if (manifestsDir.startsWith('http://') || manifestsDir.startsWith('https://')) {
			const res = await fetch(fullPath);
			return await res.text();
		}
		return await fs.readFile(fullPath, 'utf-8');
	},
});
