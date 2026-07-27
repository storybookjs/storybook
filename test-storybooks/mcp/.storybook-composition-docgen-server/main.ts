import { defineMain } from '@storybook/react-vite/node';
import baseConfig from '../.storybook/main';

/**
 * Multi-source Storybook with composition refs and `experimentalDocgenServer`.
 * Used for E2E tests that verify docgen-server mode works for the local source
 * while still fetching inline (v0) manifests from composed-in remote sources.
 */
const config = defineMain({
	...baseConfig,
	features: {
		changeDetection: true,
		componentsManifest: true,
		experimentalDocgenServer: true,
	},
	// Same public refs as `.storybook-composition/` — remote storybook-ui serves v0 manifests.
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
