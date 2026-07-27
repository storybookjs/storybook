import { defineMain } from '@storybook/react-vite/node';
import baseConfig from '../.storybook/main';

/**
 * Multi-source Storybook configuration with composition (refs).
 * Used for E2E tests that verify multi-source/composition behavior.
 */
const config = defineMain({
	...baseConfig,
	// Composition with public Chromatic Storybook (storybook-ui next branch)
	refs: {
		'storybook-ui': {
			title: 'Storybook UI',
			url: 'https://next--635781f3500dd2c49e189caf.chromatic.com',
		},
		'no-manifest': {
			title: 'No Manifest',
			url: 'https://66b1e47012f95c6f90c8882e-eplpsjesci.chromatic.com',
		},
	},
});

export default config;
