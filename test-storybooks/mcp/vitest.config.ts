import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
	test: {
		// The test-run endpoint spawns a full test run, which on a loaded Windows CI runner can
		// exceed 15s even though the same tool finishes in ~4s on unloaded hardware. The timeout
		// only matters when a test would actually exceed it, so a wide ceiling is free.
		testTimeout: 30_000,
		hookTimeout: 30_000,
		projects: [
			// E2E tests project (for MCP endpoint testing)
			{
				extends: true,
				test: {
					name: 'e2e',
					include: ['tests/**/*.e2e.test.ts'],
				},
			},
			// Storybook browser tests project
			{
				extends: true,
				plugins: [
					// The plugin will run tests for the stories defined in your Storybook config
					// See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
					storybookTest({
						configDir: path.join(path.dirname(fileURLToPath(import.meta.url)), '.storybook'),
					}) as any,
				],
				test: {
					name: 'storybook',
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({}),
						instances: [{ browser: 'chromium' }],
					},
				},
			},
		],
	},
});
