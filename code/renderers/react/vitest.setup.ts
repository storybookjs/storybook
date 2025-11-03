import { afterEach, vi } from 'vitest';

import { invalidateCache } from './src/componentManifest/utils';

afterEach(() => {
  // can not run in beforeEach because then all { spy: true } mocks get removed
  vi.restoreAllMocks();

  invalidateCache();
});
