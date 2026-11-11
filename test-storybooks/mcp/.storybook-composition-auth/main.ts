import { defineMain } from '@storybook/react-vite/node';
import baseConfig from '../.storybook/main';

/**
 * Multi-source Storybook configuration with a private Chromatic ref.
 * The E2E tests point the ref at a local fixture (`tests/ref-fixtures.ts`); without that
 * environment variable it composes the live private Chromatic Storybook, for manual testing.
 */
const config = defineMain({
	...baseConfig,
	refs: {
		'test-private-sb': {
			title: 'Test Private SB',
			url: process.env.MCP_TEST_PRIVATE_REF_URL ?? 'https://main--6985a38660050ca8a9e62053.chromatic.com',
		},
	},
});

export default config;
