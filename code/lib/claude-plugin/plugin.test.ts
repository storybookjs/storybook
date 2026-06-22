import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { x } from 'tinyexec';
import { describe, expect, it } from 'vitest';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageRoot, '../..');

type ClaudeMarketplaceJson = {
	plugins?: Array<{
		source?: string;
	}>;
};

async function isClaudeCliAvailable() {
	try {
		const result = await x('claude', ['--version'], { nodeOptions: { cwd: packageRoot } });
		return result.exitCode === 0;
	} catch {
		return false;
	}
}

const hasClaudeCli = await isClaudeCliAvailable();

function readMarketplace(path: string) {
	return JSON.parse(readFileSync(path, 'utf8')) as ClaudeMarketplaceJson;
}

function normalizeMarketplace(marketplace: ClaudeMarketplaceJson) {
	return {
		...marketplace,
		plugins: marketplace.plugins?.map((plugin) => ({
			...plugin,
			source: '<plugin-root>',
		})),
	};
}

describe('Claude launch skill guidance', () => {
	it('keeps Claude launch guidance scoped to autoPort without shell interpolation', () => {
		const launchSkill = readFileSync(
			resolve(packageRoot, 'skills/storybook-setup-claude-launch/SKILL.md'),
			'utf8',
		);

		expect(launchSkill).toContain('autoPort: true');
		expect(launchSkill).not.toMatch(/--port|\$\{?PORT\}?|\$env:PORT|%PORT%/i);
		expect(launchSkill).not.toContain('--ci');
	});
});

describe('Storybook Claude plugin CLI validation', () => {
	it('keeps root and package-local marketplaces in sync', () => {
		const packageMarketplace = readMarketplace(
			resolve(packageRoot, '.claude-plugin/marketplace.json'),
		);
		const rootMarketplace = readMarketplace(resolve(repoRoot, '.claude-plugin/marketplace.json'));

		expect(packageMarketplace.plugins?.[0]?.source).toBe('./');
		expect(rootMarketplace.plugins?.[0]?.source).toBe('./packages/claude-plugin');
		expect(normalizeMarketplace(rootMarketplace)).toEqual(normalizeMarketplace(packageMarketplace));
	});

	it.skipIf(!hasClaudeCli)(
		'passes claude plugin validate for marketplace and plugin manifests',
		async () => {
			const packageMarketplace = await x('claude', ['plugin', 'validate', '.'], {
				nodeOptions: { cwd: packageRoot },
			});
			const rootMarketplace = await x('claude', ['plugin', 'validate', '.'], {
				nodeOptions: { cwd: repoRoot },
			});
			const plugin = await x('claude', ['plugin', 'validate', '.claude-plugin/plugin.json'], {
				nodeOptions: { cwd: packageRoot },
			});

			expect(packageMarketplace.exitCode).toBe(0);
			expect(rootMarketplace.exitCode).toBe(0);
			expect(plugin.exitCode).toBe(0);
		},
	);
});
