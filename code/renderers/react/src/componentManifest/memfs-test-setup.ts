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
import path from 'pathe';
import { loadConfig } from 'tsconfig-paths';

import { fsMocks } from './fixtures.ts';
import { cachedFindUp, cachedResolveImport, invalidateCache } from './utils.ts';

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
  vi.mocked(cachedResolveImport).mockImplementation((id, options) => {
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

    if (
      typeof id === 'string' &&
      id.startsWith('.') &&
      options &&
      'basedir' in options &&
      typeof options.basedir === 'string'
    ) {
      const { basedir } = options;
      const candidates = ['.tsx', '.ts', '.jsx', '.js'].map((extension) =>
        path.resolve(basedir, `${id}${extension}`)
      );
      const existingCandidate = candidates.find((candidate) => vol.existsSync(candidate));

      if (existingCandidate) {
        return existingCandidate;
      }
    }

    throw new Error(`Unable to resolve ${id}`);
  });
}
