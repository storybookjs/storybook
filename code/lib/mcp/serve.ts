import { createStorybookMcpHandler } from './src/index.ts';
import { serve } from 'srvx';
import fs from 'node:fs/promises';

const storybookMcpHandler = await createStorybookMcpHandler({
	// fetch the manifest from this local server, itself
	source: 'http://localhost:13316/fixtures/full-manifest.fixture.json',
});

serve({
	async fetch(req) {
		const pathname = new URL(req.url).pathname;

		if (pathname === '/mcp') {
			return await storybookMcpHandler(req);
		}

		// Serve local manifests for the tools to use
		if (pathname.startsWith('/fixtures')) {
			try {
				const fixture = await fs.readFile(`.${pathname}`, 'utf-8');
				return new Response(fixture, {
					headers: { 'Content-Type': 'application/json' },
				});
			} catch {}
		}
		return new Response('Not found', { status: 404 });
	},
	port: 13316,
});
