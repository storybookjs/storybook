import { defineMain } from '@storybook/react-vite/node';
import baseConfig from '../.storybook/main';

/**
 * The adversarial "installed but not enabled" configuration: `@storybook/addon-vitest` stays a
 * dependency of this package (hoisted, importable), but is removed from `addons`, so its
 * `services` hook never runs and the `test` toolset never registers. The MCP endpoint must keep
 * serving every other tool — one absent addon must never take down the whole agent surface.
 */
const config = defineMain({
	...baseConfig,
	addons: (baseConfig.addons ?? []).filter((addon) => addon !== '@storybook/addon-vitest'),
});

export default config;
