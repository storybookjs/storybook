import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pluginRoot = resolve(packageRoot, 'plugins/storybook');
const manifest = JSON.parse(readFileSync(resolve(pluginRoot, '.codex-plugin/plugin.json'), 'utf8'));
const version = manifest.version ?? 'local';
const cacheRoot = resolve(homedir(), '.codex/plugins/cache/storybook/storybook', version);

if (!existsSync(pluginRoot)) {
	throw new Error(`Plugin source not found: ${pluginRoot}`);
}

rmSync(cacheRoot, { recursive: true, force: true });
mkdirSync(cacheRoot, { recursive: true });
cpSync(pluginRoot, cacheRoot, { recursive: true });

console.log('Refreshed Codex plugin cache from local source.');
console.log(`  source: ${pluginRoot}`);
console.log(`  cache:  ${cacheRoot}`);
console.log('Restart Codex to load the updated plugin contents.');
