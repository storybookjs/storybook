import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { x } from 'tinyexec';
import { describe, expect, it } from 'vitest';

const packageRoot = dirname(fileURLToPath(import.meta.url));

function isClaudeCliAvailable() {
	const result = spawnSync('claude', ['--version'], {
		cwd: packageRoot,
		stdio: 'ignore',
	});
	return !result.error && result.status === 0;
}

const hasClaudeCli = isClaudeCliAvailable();

describe('Storybook Claude plugin CLI validation', () => {
	it.skipIf(!hasClaudeCli)(
		'passes claude plugin validate for marketplace and plugin manifests',
		async () => {
			const marketplace = await x('claude', ['plugin', 'validate', '.'], {
				nodeOptions: { cwd: packageRoot },
			});
			const plugin = await x('claude', ['plugin', 'validate', '.claude-plugin/plugin.json'], {
				nodeOptions: { cwd: packageRoot },
			});

			expect(marketplace.exitCode).toBe(0);
			expect(plugin.exitCode).toBe(0);
		},
	);
});
