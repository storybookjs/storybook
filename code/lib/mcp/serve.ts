import { createStorybookMcpHandler } from './src/index.ts';
import { serve } from 'srvx';
import fs from 'node:fs/promises';

const storybookMcpHandler = await createStorybookMcpHandler({
	// Use the local path directly via manifestProvider
	source: './fixtures/full-manifest.fixture.json',
	manifestProvider: async (source) => {
		// Read the manifest from the local file system
		return await fs.readFile(source, 'utf-8');
	},
});

serve({
	async fetch(req) {
		const pathname = new URL(req.url).pathname;

		if (pathname === '/mcp') {
			return await storybookMcpHandler(req);
		}

		return new Response('Not found', { status: 404 });
	},
	port: 13316,
});
