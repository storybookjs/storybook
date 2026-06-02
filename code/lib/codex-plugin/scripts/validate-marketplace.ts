import { deepStrictEqual } from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { x } from 'tinyexec';

const marketplaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const marketplacePath = resolve(marketplaceRoot, '.agents/plugins/marketplace.json');
const repoRoot = resolve(marketplaceRoot, '../..');
const rootMarketplacePath = resolve(repoRoot, '.agents/plugins/marketplace.json');

type MarketplaceJson = {
	name: string;
	interface?: { displayName?: string };
	plugins?: Array<{
		name?: string;
		source?: { path?: string };
	}>;
};

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

function normalizeMarketplace(marketplace: MarketplaceJson): MarketplaceJson {
	return {
		...marketplace,
		plugins: marketplace.plugins?.map((plugin) => ({
			...plugin,
			source: plugin.source ? { ...plugin.source, path: '<plugin-root>' } : plugin.source,
		})),
	};
}

async function readMarketplace(path: string): Promise<MarketplaceJson> {
	return JSON.parse(await readFile(path, 'utf8')) as MarketplaceJson;
}

function validateMarketplaceShape(
	marketplace: MarketplaceJson,
	marketplaceRoot: string,
	expectedPluginPath: string,
): string {
	assert(marketplace.name === 'storybook', 'marketplace name must be storybook');
	assert(
		marketplace.interface?.displayName === 'Storybook',
		'marketplace displayName must be Storybook',
	);

	const entry = marketplace.plugins?.[0];
	assert(entry?.name === 'storybook', 'plugin entry name must be storybook');

	const pluginPath = entry?.source?.path;
	assert(pluginPath === expectedPluginPath, `plugin path must be ${expectedPluginPath}`);

	const pluginRoot = resolve(marketplaceRoot, pluginPath);
	assert(
		existsSync(resolve(pluginRoot, '.codex-plugin/plugin.json')),
		`missing plugin manifest at ${pluginRoot}/.codex-plugin/plugin.json`,
	);
	assert(
		existsSync(resolve(pluginRoot, '.mcp.json')),
		`missing MCP config at ${pluginRoot}/.mcp.json`,
	);

	return pluginRoot;
}

async function validateCodexMarketplaceAdd(marketplaceRoot: string): Promise<void> {
	const codexHome = await mkdtemp(resolve(tmpdir(), 'codex-marketplace-'));
	try {
		const result = await x('codex', ['plugin', 'marketplace', 'add', marketplaceRoot], {
			nodeOptions: { env: { ...process.env, CODEX_HOME: codexHome } },
			throwOnError: true,
		});

		assert(result.stdout.includes('Added marketplace `storybook`'), result.stdout);

		const config = await readFile(resolve(codexHome, 'config.toml'), 'utf8');
		assert(
			config.includes('[marketplaces.storybook]'),
			'config.toml missing storybook marketplace',
		);
		assert(config.includes(marketplaceRoot), 'config.toml source must point at marketplace root');
	} finally {
		await rm(codexHome, { recursive: true, force: true });
	}
}

const packageMarketplace = await readMarketplace(marketplacePath);
const rootMarketplace = await readMarketplace(rootMarketplacePath);

const packagePluginRoot = validateMarketplaceShape(
	packageMarketplace,
	marketplaceRoot,
	'./plugins/storybook',
);
const rootPluginRoot = validateMarketplaceShape(
	rootMarketplace,
	repoRoot,
	'./packages/codex-plugin/plugins/storybook',
);

deepStrictEqual(normalizeMarketplace(rootMarketplace), normalizeMarketplace(packageMarketplace));

await validateCodexMarketplaceAdd(marketplaceRoot);
await validateCodexMarketplaceAdd(repoRoot);

console.log('Codex marketplace validation passed.');
console.log(`  package marketplace root: ${marketplaceRoot}`);
console.log(`  package plugin root: ${packagePluginRoot}`);
console.log(`  root marketplace root: ${repoRoot}`);
console.log(`  root plugin root: ${rootPluginRoot}`);
