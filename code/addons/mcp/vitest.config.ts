import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';

export default defineConfig({
	test: {
		coverage: {
			include: ['src'],
		},
	},
	plugins: [
		// handle markdown files in Vitests
		{
			name: 'md-loader',
			transform(code, id) {
				if (id.endsWith('.md')) {
					const content = readFileSync(id, 'utf-8');
					return {
						code: `export default ${JSON.stringify(content)};`,
						map: null,
					};
				}
			},
		},
	],
});
