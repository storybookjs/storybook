import { rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'pathe';
import { x } from 'tinyexec';

await x('claude', ['plugin', 'uninstall', 'storybook@storybook', '--scope', 'user'], {
  throwOnError: true,
});
await x('claude', ['plugin', 'marketplace', 'remove', 'storybook'], { throwOnError: true });
rmSync(resolve(homedir(), '.claude/plugins/cache/storybook'), { recursive: true, force: true });
