import { defineConfig } from 'tsdown';
import sharedTsDownConfig from '../../tsdown-shared.config.ts';

export default defineConfig({
	...sharedTsDownConfig,
	entry: 'src/preset.ts',
});
