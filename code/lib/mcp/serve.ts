import { createStorybookMcpHandler } from './src/index.ts';
import { serve } from 'srvx';
import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';

async function serveMcp(port: number, manifestPath: string) {
	const storybookMcpHandler = await createStorybookMcpHandler({
		// Use the local fixture file via manifestProvider
		manifestProvider: async () => {
			if (
				manifestPath.startsWith('http://') ||
				manifestPath.startsWith('https://')
			) {
				const res = await fetch(manifestPath);
				return await res.text();
			}
			return await fs.readFile(manifestPath, 'utf-8');
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
		port,
	});
}

// @ts-ignore
if (import.meta.main) {
	const args = parseArgs({
		options: {
			port: {
				type: 'string',
				default: '13316',
			},
			manifestPath: {
				type: 'string',
				default: './fixtures/full-manifest.fixture.json',
			},
		},
	});
	await serveMcp(Number(args.values.port), args.values.manifestPath);
}
