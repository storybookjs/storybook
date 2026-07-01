/**
 * This is a way to start the @storybook/mcp server as a stdio MCP server, which is sometimes easier for testing.
 * You can run it like this:
 *   node bin.ts --manifestsDir ./path/to/manifests/dir/
 *
 * Or when configuring it as an MCP server:
 * {
 *   "storybook-mcp": {
 *     "type": "stdio",
 *     "command": "node",
 *     "args": ["bin.ts", "--manifestsDir", "./path/to/manifests/dir/"]
 *   }
 * }
 */
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { StdioTransport } from '@tmcp/transport-stdio';
import pkgJson from './package.json' with { type: 'json' };
import { addListAllDocumentationTool } from './src/tools/list-all-documentation.ts';
import { addGetStoryDocumentationTool } from './src/tools/get-documentation-for-story.ts';
import { addGetDocumentationTool } from './src/tools/get-documentation.ts';
import type { StorybookContext } from './src/types.ts';
import { parseArgs } from 'node:util';
import * as fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverInstructions = readFileSync(
	resolve(dirname(fileURLToPath(import.meta.url)), './src/instructions.md'),
	'utf-8',
);

function resolveManifestFile(base: string, rel: string): string {
	const resolvedBase = resolve(base);
	const resolved = resolve(resolvedBase, rel);
	if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + sep)) {
		throw new Error(`Refusing to read manifest outside base: ${rel}`);
	}
	return resolved;
}

const adapter = new ValibotJsonSchemaAdapter();
const server = new McpServer(
	{
		name: pkgJson.name,
		version: pkgJson.version,
		description: pkgJson.description,
	},
	{
		adapter,
		instructions: serverInstructions,
		capabilities: {
			tools: { listChanged: true },
		},
	},
).withContext<StorybookContext>();

await addListAllDocumentationTool(server);
await addGetStoryDocumentationTool(server);
await addGetDocumentationTool(server);

const transport = new StdioTransport(server);
const args = parseArgs({
	options: {
		manifestsDir: {
			type: 'string',
			default: './fixtures/default',
		},
	},
});

transport.listen({
	manifestProvider: async (_request, path) => {
		const { manifestsDir } = args.values;
		const isRemote = manifestsDir.startsWith('http://') || manifestsDir.startsWith('https://');

		// Top-level manifests (`./manifests/<name>.json`) live in `manifestsDir`; split/ref
		// payloads (`./services/<service>/<id>.json`) live in a sibling `services/` directory.
		const normalized = path.replace(/^\.?\//, '');
		const { base, rel } = normalized.startsWith('manifests/')
			? { base: manifestsDir, rel: normalized.slice('manifests/'.length) }
			: {
					base: isRemote ? manifestsDir.replace(/\/[^/]+\/?$/, '') : dirname(manifestsDir),
					rel: normalized,
				};

		if (isRemote) {
			const res = await fetch(`${base.replace(/\/$/, '')}/${rel}`);
			if (!res.ok) {
				throw new Error(`Failed to fetch manifest (${res.status}) from ${res.url}`);
			}
			return await res.text();
		}
		return await fs.readFile(resolveManifestFile(base, rel), 'utf-8');
	},
});
