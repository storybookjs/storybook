import { defineMain } from '@storybook/react-vite/node';
import baseConfig from '../.storybook/main';

/**
 * Multi-source Storybook configuration with a private Chromatic ref.
 * Used for manual testing of the OAuth composition auth flow.
 */
const config = defineMain({
	...baseConfig,
	refs: {
		'test-private-sb': {
			title: 'Test Private SB',
			url: 'https://main--6985a38660050ca8a9e62053.chromatic.com',
		},
	},
});

export default config;
