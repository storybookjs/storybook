import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'ecosystem-qa',
    include: ['lib/**/*.test.ts'],
  },
});
