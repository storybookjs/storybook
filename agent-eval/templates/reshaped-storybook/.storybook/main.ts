import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
	stories: ['../@(stories|src)/*.stories.@(js|jsx|mjs|ts|tsx)'],
	staticDirs: ['../public'],
	addons: [
		'@storybook/addon-a11y',
		'@storybook/addon-vitest',
		'@storybook/addon-docs',
		'@storybook/addon-mcp',
	],
	framework: '@storybook/react-vite',
	refs: {
		reshaped: {
			title: 'Reshaped',
			url: 'https://6a4591e9e7caa5800ab7c0c6-jdcmvailri.chromatic.com',
		},
	},
};
export default config;
