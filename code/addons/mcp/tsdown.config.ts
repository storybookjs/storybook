import { defineConfig } from 'tsdown';
import sharedTsDownConfig from '../../tsdown-shared.config.ts';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
	...sharedTsDownConfig(pkg.name),
	entry: 'src/preset.ts',
});
