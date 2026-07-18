import { afterEach, describe, expect, it, vi } from 'vitest';

import { experimental_vitePlugin } from './index.ts';

describe('experimental_vitePlugin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('deactivates when the Storybook CLI is driving Vite', async () => {
    vi.stubEnv('STORYBOOK_CLI', 'true');

    await expect(experimental_vitePlugin()).resolves.toEqual([]);
  });
});
