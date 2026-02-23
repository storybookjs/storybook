import { defineMain } from '@storybook/react-vite/node';

/**
 * Single-source Storybook configuration (no refs/composition).
 * For multi-source/composition tests, see .storybook-composition/
 */
const config = defineMain({
	stories: [
		'../stories/**/*.mdx',
		'../stories/components/**/*.stories.@(js|jsx|ts|tsx)',
		{
			titlePrefix: 'Other UI',
			directory: '../stories/other',
			files: '**/*.stories.@(js|jsx|ts|tsx)',
		},
	],
	addons: [
		'@storybook/addon-docs',
		'@storybook/addon-a11y',
		'@storybook/addon-vitest',
		'@storybook/addon-themes',
		{
			name: '@storybook/addon-mcp',
			options: {},
		},
	],
	framework: '@storybook/react-vite',
	core: {
		disableTelemetry: true,
	},
	features: {
		experimentalComponentsManifest: true,
	},
	// No refs - single source mode
});

export default config;
