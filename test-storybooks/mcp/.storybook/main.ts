import { defineMain } from '@storybook/react-vite/node';

const config = defineMain({
	stories: [
		'../stories/**/*.mdx',
		'../stories/components/**/*.stories.@(js|jsx|ts|tsx)',
		{
			titlePrefix: 'Other UI',
			directory: '../src/stories/other',
			files: '**/*.stories.@(js|jsx|ts|tsx)',
		},
	],
	addons: ['@storybook/addon-docs', '@storybook/addon-mcp'],
	framework: '@storybook/react-vite',
	logLevel: 'debug',
	core: {
		disableTelemetry: true,
	},
	features: {
		experimentalComponentsManifest: true,
	},
});

export default config;
