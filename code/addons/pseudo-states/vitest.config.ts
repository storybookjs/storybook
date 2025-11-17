import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    typecheck: {
      enabled: true,
    },
  },
});
