import sharedVitestConfig from '../../vitest-shared.config.ts';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(sharedVitestConfig, {
	test: {
		setupFiles: ['./vitest.setup.ts'],
		coverage: {
			include: ['src'],
		},
	},
	plugins: [
		// handle markdown files in Vitest
		{
			name: 'md-loader',
			transform(code: string, id: string) {
				if (id.endsWith('.md')) {
					return {
						code: `export default ${JSON.stringify(code)};`,
						map: null,
					};
				}
			},
		},
	],
});
