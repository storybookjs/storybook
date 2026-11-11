import { defineMain } from '@storybook/react-vite/node';
import baseConfig from '../.storybook/main';

/**
 * Multi-source Storybook configuration with composition (refs).
 * Used for E2E tests that verify multi-source/composition behavior.
 */
const config = defineMain({
	...baseConfig,
	// The E2E tests point these refs at local fixtures (`tests/ref-fixtures.ts`); without those
	// environment variables they compose the live Chromatic Storybooks, for manual testing.
	// Composition with public Chromatic Storybook (storybook-ui main branch).
	// Prefer main-- over next--: next builds currently omit /manifests/components.json.
	refs: {
		'storybook-ui': {
			title: 'Storybook UI',
			url: process.env.MCP_TEST_PUBLIC_REF_URL ?? 'https://main--635781f3500dd2c49e189caf.chromatic.com',
		},
		'no-manifest': {
			title: 'No Manifest',
			url: process.env.MCP_TEST_NO_MANIFEST_REF_URL ?? 'https://66b1e47012f95c6f90c8882e-eplpsjesci.chromatic.com',
		},
	},
});

export default config;
