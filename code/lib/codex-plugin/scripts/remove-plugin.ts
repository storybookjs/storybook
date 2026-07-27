import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { x } from 'tinyexec';

import { removeTomlSection } from './toml.ts';

const configPath = resolve(homedir(), '.codex/config.toml');
const pluginSection = `[plugins."storybook@storybook"]`;

await x('codex', ['plugin', 'marketplace', 'remove', 'storybook'], { throwOnError: true });

const config = readFileSync(configPath, 'utf8');
const next = removeTomlSection(config, pluginSection);
if (next !== config) {
	writeFileSync(configPath, next, 'utf8');
}

rmSync(resolve(homedir(), '.codex/plugins/cache/storybook'), { recursive: true, force: true });
