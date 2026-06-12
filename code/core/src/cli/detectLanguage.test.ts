import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { SupportedLanguage } from 'storybook/internal/types';

import * as memfs from 'memfs';
import { vol } from 'memfs';

import { detectLanguage } from './detectLanguage.ts';

vi.mock('node:fs', { spy: true });

const packageManager = (dependencies: Record<string, string>) =>
  ({
    getAllDependencies: () => dependencies,
    getModulePackageJSON: async (pkg: string) =>
      dependencies[pkg] ? { version: dependencies[pkg] } : null,
  }) as unknown as JsPackageManager;

describe('detectLanguage', () => {
  beforeEach(async () => {
    vol.reset();
    const fs = await import('node:fs');
    vi.mocked(fs.existsSync).mockImplementation(memfs.fs.existsSync as typeof fs.existsSync);
  });

  it('scans the given workingDir, not the process cwd', async () => {
    vol.fromNestedJSON({ '/project/tsconfig.json': '{}' });

    await expect(detectLanguage(packageManager({}), '/project')).resolves.toBe(
      SupportedLanguage.TYPESCRIPT
    );
    await expect(detectLanguage(packageManager({}), '/elsewhere')).resolves.toBe(
      SupportedLanguage.JAVASCRIPT
    );
  });

  it('treats a jsconfig.json in the workingDir as JavaScript even with a typescript dependency', async () => {
    vol.fromNestedJSON({ '/project/jsconfig.json': '{}' });

    await expect(detectLanguage(packageManager({ typescript: '5.6.0' }), '/project')).resolves.toBe(
      SupportedLanguage.JAVASCRIPT
    );
  });

  it('detects TypeScript from a compatible direct dependency without config files', async () => {
    await expect(detectLanguage(packageManager({ typescript: '5.6.0' }), '/project')).resolves.toBe(
      SupportedLanguage.TYPESCRIPT
    );
  });

  it('falls back to JavaScript when the typescript dependency is incompatible', async () => {
    await expect(detectLanguage(packageManager({ typescript: '4.0.0' }), '/project')).resolves.toBe(
      SupportedLanguage.JAVASCRIPT
    );
  });
});
