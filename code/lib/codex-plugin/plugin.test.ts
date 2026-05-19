import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(packageRoot, 'plugins/storybook');

const skillNames = ['storybook-init', 'storybook-mcp-setup', 'storybook-upgrade'];

describe('Storybook Codex plugin package', () => {
	it('ships a valid local marketplace plugin bundle', async () => {
		for (const relativePath of [
			'.agents/plugins/marketplace.json',
			'plugins/storybook/.codex-plugin/plugin.json',
			'plugins/storybook/.mcp.json',
			'plugins/storybook/assets/storybook.svg',
			...skillNames.map((name) => `plugins/storybook/skills/${name}/SKILL.md`),
		]) {
			expect(existsSync(resolve(packageRoot, relativePath)), relativePath).toBe(true);
		}

		const marketplace = JSON.parse(
			await readFile(resolve(packageRoot, '.agents/plugins/marketplace.json'), 'utf8'),
		);
		expect(marketplace.plugins[0]).toMatchObject({
			name: 'storybook',
			source: {
				source: 'local',
				path: './plugins/storybook',
			},
		});

		const mcpConfig = JSON.parse(await readFile(resolve(pluginRoot, '.mcp.json'), 'utf8'));
		const storybook = mcpConfig.storybook;

		expect(storybook.command).toBe('npx');
		expect(storybook.args[0]).toBe('-y');
		expect(storybook.args.at(-1)).toMatch(/pkg\.pr\.new\/.*@storybook\/mcp-proxy/);
	});
});
