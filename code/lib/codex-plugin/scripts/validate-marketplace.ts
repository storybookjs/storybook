import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { x } from 'tinyexec';

const marketplaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const marketplacePath = resolve(marketplaceRoot, '.agents/plugins/marketplace.json');

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

const marketplace = JSON.parse(await readFile(marketplacePath, 'utf8')) as MarketplaceJson;
assert(marketplace.name === 'storybook', 'marketplace name must be storybook');
assert(
	marketplace.interface?.displayName === 'Storybook',
	'marketplace displayName must be Storybook',
);

const entry = marketplace.plugins?.[0];
assert(entry?.name === 'storybook', 'plugin entry name must be storybook');

const pluginPath = entry?.source?.path;
assert(
	typeof pluginPath === 'string' && pluginPath.startsWith('./'),
	'plugin path must start with ./',
);

const pluginRoot = resolve(marketplaceRoot, pluginPath);
assert(
	existsSync(resolve(pluginRoot, '.codex-plugin/plugin.json')),
	`missing plugin manifest at ${pluginRoot}/.codex-plugin/plugin.json`,
);
assert(
	existsSync(resolve(pluginRoot, '.mcp.json')),
	`missing MCP config at ${pluginRoot}/.mcp.json`,
);

const codexHome = await mkdtemp(resolve(tmpdir(), 'codex-marketplace-'));
try {
	const result = await x('codex', ['plugin', 'marketplace', 'add', marketplaceRoot], {
		nodeOptions: { env: { ...process.env, CODEX_HOME: codexHome } },
		throwOnError: true,
	});

	assert(result.stdout.includes('Added marketplace `storybook`'), result.stdout);

	const config = await readFile(resolve(codexHome, 'config.toml'), 'utf8');
	assert(config.includes('[marketplaces.storybook]'), 'config.toml missing storybook marketplace');
	assert(config.includes(marketplaceRoot), 'config.toml source must point at marketplace root');

	console.log('Codex marketplace validation passed.');
	console.log(`  marketplace root: ${marketplaceRoot}`);
	console.log(`  plugin root: ${pluginRoot}`);
} finally {
	await rm(codexHome, { recursive: true, force: true });
}
