import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { x } from 'tinyexec';
import { describe, expect, it } from 'vitest';

const packageRoot = dirname(fileURLToPath(import.meta.url));

describe('Storybook Claude plugin CLI validation', () => {
	it('passes claude plugin validate for marketplace and plugin manifests', async (context) => {
		const version = await x('claude', ['--version'], {
			throwOnError: false,
			nodeOptions: { cwd: packageRoot },
		});

		if (version.exitCode !== 0) {
			context.skip();
			return;
		}

		const marketplace = await x('claude', ['plugin', 'validate', '.'], {
			nodeOptions: { cwd: packageRoot },
		});
		const plugin = await x('claude', ['plugin', 'validate', '.claude-plugin/plugin.json'], {
			nodeOptions: { cwd: packageRoot },
		});

		expect(marketplace.exitCode).toBe(0);
		expect(plugin.exitCode).toBe(0);
	});
});
