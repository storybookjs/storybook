import { createStorybookMcpHandler } from './src/index.ts';
import { serve } from 'srvx';
import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';
import type { OutputFormat } from './src/types.ts';
import { basename } from 'node:path';

async function serveMcp(port: number, manifestsDir: string, format: OutputFormat) {
	const storybookMcpHandler = await createStorybookMcpHandler({
		format,
		// Use the local fixture file via manifestProvider
		manifestProvider: async (_request, path) => {
			if (manifestsDir.startsWith('http://') || manifestsDir.startsWith('https://')) {
				const res = await fetch(`${manifestsDir}/${basename(path)}`);
				return await res.text();
			}
			return await fs.readFile(`${manifestsDir}/${basename(path)}`, 'utf-8');
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
	await serveMcp(
		Number(args.values.port),
		args.values.manifestsDir,
		args.values.format as OutputFormat,
	);
}
