import { mergeConfig } from 'vite';

import { defineProject } from 'vitest/config';
import vitestConfig from '../../vitest.config.ts';

export default mergeConfig(
	vitestConfig,
	defineProject({
		test: {
			setupFiles: ['./vitest.setup.ts'],
		},
	}),
);
