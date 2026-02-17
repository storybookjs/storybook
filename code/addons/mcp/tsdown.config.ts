import { defineConfig } from 'tsdown';
import sharedTsDownConfig from '../../tsdown-shared.config.ts';
import pkg from './package.json' with { type: 'json' };

const sharedNodeConfig = sharedTsDownConfig(pkg.name);
const browserConfig = {
	...sharedTsDownConfig(pkg.name),
	target: 'chrome131',
};
export default defineConfig([
	{
		...sharedNodeConfig,
		entry: 'src/preset.ts',
		external: [/^@storybook\/addon-vitest/, /^@storybook\/addon-a11y/],
	},
	{
		...browserConfig,
		entry: 'src/preview.ts',
	},
	/*
	this must be a separate config because it can't rely on code splitting at all.
	Using a shared config would risk code being shared between entries
	which would break the MCP App script
	*/
	{
		...browserConfig,
		entry: 'src/tools/preview-stories/preview-stories-app-script.ts',
	},
]);
