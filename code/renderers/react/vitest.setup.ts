import { afterEach, vi } from 'vitest';

afterEach(() => {
  // can not run in beforeEach because then all { spy: true } mocks get removed
  vi.restoreAllMocks();
});
