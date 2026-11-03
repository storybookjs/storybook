import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import type { CheckOptions, RunOptions } from '../types.ts';
import { typescript7ReactDocgen } from './typescript-7-react-docgen.ts';

// TEMPORARY until Storybook supports TypeScript 7.1: delete together with the fix.

const packageManagerWith = (dependencies: Record<string, string>) =>
  ({
    isDependencyInstalled: (name: string) => name in dependencies,
    getDeclaredVersionSpecifier: async (name: string) => dependencies[name] ?? null,
    addDependencies: vi.fn().mockResolvedValue(undefined),
    primaryPackageJson: { packageJson: {}, operationDir: '/project' },
    writePackageJson: vi.fn(),
  }) as unknown as JsPackageManager;

const upgrade = { beforeVersion: '10.3.0', storybookVersion: '11.0.0' };

const check = (
  mainConfig: Record<string, unknown>,
  dependencies: Record<string, string>,
  versions: Partial<CheckOptions> = upgrade
) =>
  checkFix(typescript7ReactDocgen, {
    mainConfig: mainConfig as unknown as StorybookConfigRaw,
    packageManager: packageManagerWith(dependencies),
    ...versions,
  } as CheckOptions);

describe('typescript-7-react-docgen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['@storybook/react-vite', '@storybook/nextjs', '@storybook/nextjs-vite'])(
    'applies to a %s project on TypeScript 7',
    async (framework) => {
      await expect(check({ framework }, { typescript: '~7.0.2' })).resolves.toBe(true);
    }
  );

  it.each([
    ['TypeScript 6', { typescript: '^6.0.3' }],
    ['no TypeScript, which typescript-dependency adds', {}],
    ['react-docgen already installed', { typescript: '~7.0.2', 'react-docgen': '^8.0.2' }],
  ])('skips a project with %s', async (_name, dependencies) => {
    await expect(check({ framework: '@storybook/react-vite' }, dependencies)).resolves.toBeNull();
  });

  it.each([
    [
      'docgenServer: false, which installs its packages itself',
      { features: { docgenServer: false } },
    ],
    ['reactDocgen: false', { typescript: { reactDocgen: false } }],
  ])('skips a project with %s', async (_name, config) => {
    await expect(
      check({ framework: '@storybook/react-vite', ...config }, { typescript: '~7.0.2' })
    ).resolves.toBeNull();
  });

  it('skips other renderers', async () => {
    await expect(
      check({ framework: '@storybook/vue3-vite' }, { typescript: '~7.0.2' })
    ).resolves.toBeNull();
  });

  it('skips an upgrade within Storybook 11', async () => {
    await expect(
      check(
        { framework: '@storybook/react-vite' },
        { typescript: '~7.0.2' },
        { beforeVersion: '11.0.0', storybookVersion: '11.0.1' }
      )
    ).resolves.toBeNull();
  });

  it('adds react-docgen and records it as temporary', async () => {
    const packageManager = packageManagerWith({ typescript: '~7.0.2' });

    await runFix(typescript7ReactDocgen, {
      result: true,
      packageManager,
      mainConfigPath: '/project/.storybook/main.ts',
      configDir: '/project/.storybook',
      storiesPaths: [],
      storybookVersion: '11.0.0',
    } as unknown as Omit<RunOptions<true>, 'files'>);

    expect(packageManager.addDependencies).toHaveBeenCalledWith(
      { type: 'devDependencies', skipInstall: true },
      ['react-docgen@^8.0.2']
    );
    expect(packageManager.primaryPackageJson.packageJson).toEqual({
      storybook: { temporaryDependencies: ['react-docgen'] },
    });
  });
});
