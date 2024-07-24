import type { StorybookConfig } from "@storybook/nextjs";
import vitePluginNext from "vite-plugin-storybook-nextjs";

const config: StorybookConfig = {
	stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
	addons: [
		"@storybook/addon-onboarding",
		"@storybook/addon-links",
		"@storybook/addon-essentials",
		"@chromatic-com/storybook",
		"@storybook/addon-interactions",
	],
	framework: {
		name: "@storybook/nextjs",
		options: {},
	},
	core: {
		builder: "@storybook/builder-vite",
	},
	staticDirs: ["../public"],
	viteFinal: (config) => {
		config.plugins.push(vitePluginNext());
		return config;
	},
};
export default config;
