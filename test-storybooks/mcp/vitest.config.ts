import { defineProject } from 'vitest/config';

export default defineProject({
	test: {
		name: 'e2e',
		testTimeout: 15_000,
		hookTimeout: 15_000,
	},
});
