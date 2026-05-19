import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const marketplaceRoot = resolve(scriptRoot, '..');
const marketplacePath = resolve(marketplaceRoot, '.agents/plugins/marketplace.json');

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

const marketplace = JSON.parse(await readFile(marketplacePath, 'utf8'));
assert(marketplace.name === 'storybook', 'marketplace name must be storybook');
assert(marketplace.interface?.displayName === 'Storybook', 'marketplace displayName must be Storybook');

const entry = marketplace.plugins?.[0];
assert(entry?.name === 'storybook', 'plugin entry name must be storybook');

const pluginPath = entry?.source?.path;
assert(typeof pluginPath === 'string' && pluginPath.startsWith('./'), 'plugin path must start with ./');

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
	const stdout = execFileSync(
		'codex',
		['plugin', 'marketplace', 'add', marketplaceRoot],
		{
			env: { ...process.env, CODEX_HOME: codexHome },
			encoding: 'utf8',
		},
	);

	assert(stdout.includes('Added marketplace `storybook`'), `unexpected codex output: ${stdout}`);

	const config = await readFile(resolve(codexHome, 'config.toml'), 'utf8');
	assert(config.includes('[marketplaces.storybook]'), 'config.toml missing storybook marketplace');
	assert(config.includes(marketplaceRoot), 'config.toml source must point at marketplace root');

	console.log('Codex marketplace validation passed.');
	console.log(`  marketplace root: ${marketplaceRoot}`);
	console.log(`  plugin root: ${pluginRoot}`);
} finally {
	await rm(codexHome, { recursive: true, force: true });
}
