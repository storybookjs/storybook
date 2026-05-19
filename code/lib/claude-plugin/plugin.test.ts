import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageRoot = dirname(fileURLToPath(import.meta.url));

const skillNames = [
	'storybook-init',
	'storybook-launch-setup',
	'storybook-mcp-setup',
	'storybook-upgrade',
];

describe('Storybook Claude plugin package', () => {
	it('ships a valid local marketplace plugin bundle', async () => {
		for (const relativePath of [
			'.claude-plugin/marketplace.json',
			'.claude-plugin/plugin.json',
			'.mcp.json',
			...skillNames.map((name) => `skills/${name}/SKILL.md`),
		]) {
			expect(existsSync(resolve(packageRoot, relativePath)), relativePath).toBe(true);
		}

		const marketplace = JSON.parse(
			await readFile(resolve(packageRoot, '.claude-plugin/marketplace.json'), 'utf8'),
		);
		expect(marketplace.plugins[0]).toMatchObject({
			name: 'storybook',
			source: './',
		});

		const mcpConfig = JSON.parse(await readFile(resolve(packageRoot, '.mcp.json'), 'utf8'));
		const storybook = mcpConfig.mcpServers.storybook;

		expect(storybook.command).toBe('npx');
		expect(storybook.args[0]).toBe('-y');
		expect(storybook.args.at(-1)).toMatch(/pkg\.pr\.new\/.*@storybook\/mcp-proxy/);
	});
});
