import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
	stories: ['../@(stories|src)/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
	addons: [
		'@storybook/addon-a11y',
		'@storybook/addon-vitest',
		'@storybook/addon-docs',
		'@storybook/addon-mcp',
	],
	framework: '@storybook/react-vite',
};
export default config;
