import { defineMain } from '@storybook/react-vite/node';

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
		{
			name: '@storybook/addon-mcp',
			options: {
				toolsets: {
					// storiesDevelopment: false,
					// componentDocumentation: false,
				},
			},
		},
	],
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
