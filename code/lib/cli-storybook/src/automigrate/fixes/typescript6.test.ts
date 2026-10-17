import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import type { CheckOptions, RunOptions } from '../types.ts';
import { typescript6 } from './typescript6.ts';

const packageManagerWith = (dependencies: Record<string, string>, installed: string | null) => {
  return {
    getAllDependencies: () => dependencies,
    getInstalledVersion: vi.fn().mockResolvedValue(installed),
    addDependencies: vi.fn().mockResolvedValue(undefined),
  } as unknown as JsPackageManager;
};

const checkOptions = {
  mainConfig: {},
  storybookVersion: '11.0.0',
  storiesPaths: [],
} as CheckOptions;

describe('typescript6 fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips projects that are not on TypeScript 7', async () => {
    const packageManager = packageManagerWith({ typescript: '^6.0.3' }, '6.0.3');
    await expect(checkFix(typescript6, { ...checkOptions, packageManager })).resolves.toBeNull();
  });

  it('installs @typescript/typescript6 for TypeScript 7', async () => {
    const packageManager = packageManagerWith({ typescript: '^7.0.0' }, '7.0.2');
    await expect(checkFix(typescript6, { ...checkOptions, packageManager })).resolves.toEqual({});

    await runFix(typescript6, {
      result: {},
      packageManager,
      mainConfigPath: '/project/.storybook/main.ts',
      configDir: '/project/.storybook',
      storiesPaths: [],
      mainConfig: {},
      storybookVersion: '11.0.0',
    } as unknown as Omit<RunOptions<object>, 'files'>);

    expect(packageManager.addDependencies).toHaveBeenCalledWith(
      { type: 'devDependencies', skipInstall: true },
      ['@typescript/typescript6@^6.0.2']
    );
  });
});
