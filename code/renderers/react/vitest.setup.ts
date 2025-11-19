import { beforeEach, vi } from 'vitest';

import { type JsPackageManager, JsPackageManagerFactory } from 'storybook/internal/common';

import { vol } from 'memfs';
import { loadConfig } from 'tsconfig-paths';

import { cachedFindUp, cachedResolveImport, invalidateCache } from './src/componentManifest/utils';

vi.mock('node:fs/promises', async () => {
  const fs = (await import('memfs')).fs.promises;
  return { default: fs, ...fs };
});
vi.mock('node:fs', async () => {
  const fs = (await import('memfs')).fs;
  return { default: fs, ...fs };
});

vi.mock(import('./src/componentManifest/utils'), { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('empathic/find', { spy: true });
vi.mock('tsconfig-paths', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.resetAllMocks();
  invalidateCache();

  vi.mocked(loadConfig).mockImplementation(() => ({ resultType: 'failed' as const, message: '' }));
  vi.mocked(cachedFindUp).mockImplementation(() => '/app/package.json');
  vi.mocked(JsPackageManagerFactory.getPackageManager).mockImplementation(
    () =>
      ({
        primaryPackageJson: { packageJson: { name: 'some-package' } },
      }) as unknown as JsPackageManager
  );
  vi.mocked(cachedResolveImport).mockImplementation((id) => {
    return {
      './Button': './src/stories/Button.tsx',
      './Header': './src/stories/Header.tsx',
    }[id]!;
  });
});
