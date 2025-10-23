import { defineConfig } from 'vitest/config';

export default defineConfig({
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
			transform(code, id) {
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
