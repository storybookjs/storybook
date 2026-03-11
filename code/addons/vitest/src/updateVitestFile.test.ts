import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { loadTemplate } from './updateVitestFile';

vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../core/src/shared/utils/module', () => ({
  resolvePackageDir: vi.fn().mockImplementation(() => join(__dirname, '..')),
}));

describe('loadTemplate', () => {
  it('normalizes Windows paths to forward slashes', async () => {
    // Windows-style path with backslashes (need to escape them in JS strings)
    const windowsPath = '.\\apps\\frontend-storybook\\.storybook';

    const result = await loadTemplate('vitest.config.template', {
      CONFIG_DIR: windowsPath,
      SETUP_FILE: '.\\apps\\frontend-storybook\\.storybook\\vitest.setup.ts',
    });

    // Should contain forward slashes, not backslashes
    expect(result).toContain('apps/frontend-storybook/.storybook');
    expect(result).not.toContain('\\apps\\');
  });

  it('preserves forward slashes in paths', async () => {
    // Unix-style path with forward slashes
    const unixPath = './apps/frontend-storybook/.storybook';

    const result = await loadTemplate('vitest.config.template', {
      CONFIG_DIR: unixPath,
      SETUP_FILE: './apps/frontend-storybook/.storybook/vitest.setup.ts',
    });

    // Should still contain forward slashes
    expect(result).toContain('apps/frontend-storybook/.storybook');
  });
});
