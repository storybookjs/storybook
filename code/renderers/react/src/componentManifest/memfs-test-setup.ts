/**
 * Shared memfs mock setup for tests that use in-memory filesystem.
 *
 * Usage in test files: vi.mock('node:fs'); vi.mock('node:fs/promises'); vi.mock(import('./utils'),
 * { spy: true }); vi.mock('storybook/internal/common', { spy: true }); vi.mock('empathic/find', {
 * spy: true }); vi.mock('tsconfig-paths', { spy: true });
 *
 * BeforeEach(() => { setupMemfsMocks(); });
 */
import { vi } from 'vitest';

import { type JsPackageManager, JsPackageManagerFactory } from 'storybook/internal/common';

import { vol } from 'memfs';
import { loadConfig } from 'tsconfig-paths';

import { fsMocks } from './fixtures';
import { cachedFindUp, cachedResolveImport, invalidateCache } from './utils';

export function setupMemfsMocks() {
  vol.reset();
  vi.clearAllMocks();
  invalidateCache();

  vi.spyOn(process, 'cwd').mockReturnValue('/app');
  vol.fromJSON(fsMocks, '/app');

  vi.mocked(loadConfig).mockImplementation(() => ({ resultType: 'failed' as const, message: '' }));
  vi.mocked(cachedFindUp).mockImplementation(() => '/app/package.json');
  vi.mocked(JsPackageManagerFactory.getPackageManager).mockImplementation(
    () =>
      ({
        primaryPackageJson: { packageJson: { name: 'some-package' } },
      }) as unknown as JsPackageManager
  );
  vi.mocked(cachedResolveImport).mockImplementation((id) => {
    const pkg: Record<string, string> = {
      '@design-system/button': './src/stories/Button.tsx',
      '@ds/button': './src/stories/Button.tsx',
      '@ds/header': './src/stories/Header.tsx',
      './Button': './src/stories/Button.tsx',
      './Header': './src/stories/Header.tsx',
    };
    if (pkg[id]) {
      return pkg[id];
    }
    throw new Error(`Unable to resolve ${id}`);
  });
}
