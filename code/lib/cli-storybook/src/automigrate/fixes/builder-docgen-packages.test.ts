import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import type { CheckOptions, RunOptions } from '../types.ts';
import {
  type BuilderDocgenPackagesResult,
  builderDocgenPackages,
} from './builder-docgen-packages.ts';

const packageManagerWith = (dependencies: Record<string, string>) =>
  ({
    isDependencyInstalled: (name: string) => name in dependencies,
    getDeclaredVersionSpecifier: async (name: string) => dependencies[name] ?? null,
    addDependencies: vi.fn().mockResolvedValue(undefined),
  }) as unknown as JsPackageManager;

const upgrade = { beforeVersion: '10.3.0', storybookVersion: '11.0.0' };

const check = (
  mainConfig: Record<string, unknown>,
  dependencies: Record<string, string>,
  versions: Partial<CheckOptions> = upgrade
) =>
  checkFix(builderDocgenPackages, {
    mainConfig: mainConfig as unknown as StorybookConfigRaw,
    packageManager: packageManagerWith(dependencies),
    ...versions,
  } as CheckOptions);

const docgenServerOff = { docgenServer: false } as StorybookConfigRaw['features'];

describe('builder-docgen-packages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds react-docgen when the main config turns the docgen server off', async () => {
    await expect(
      check(
        { framework: '@storybook/react-vite', features: docgenServerOff },
        { typescript: '^6.0.3' }
      )
    ).resolves.toEqual({
      packages: ['react-docgen'],
      reactDocgen: 'react-docgen',
      reason: 'docgen-server-disabled',
    });
  });

  it.each([
    [
      '@storybook/react-vite',
      ['@joshwooding/vite-plugin-react-docgen-typescript', 'react-docgen-typescript'],
    ],
    [
      '@storybook/nextjs-vite',
      ['@joshwooding/vite-plugin-react-docgen-typescript', 'react-docgen-typescript'],
    ],
    [
      '@storybook/react-webpack5',
      ['@storybook/react-docgen-typescript-plugin', 'react-docgen-typescript'],
    ],
    ['@storybook/nextjs', ['@storybook/react-docgen-typescript-plugin', 'react-docgen-typescript']],
  ])('adds the react-docgen-typescript packages for %s', async (framework, packages) => {
    const result = await check(
      {
        framework,
        features: docgenServerOff,
        typescript: { reactDocgen: 'react-docgen-typescript' },
      },
      { typescript: '^6.0.3' }
    );

    expect(result?.packages).toEqual(packages);
  });

  it('adds react-docgen for a project on TypeScript 7, which falls back to builder docgen', async () => {
    const result = await check({ framework: '@storybook/react-vite' }, { typescript: '~7.0.2' });

    expect(result).toEqual({
      packages: ['react-docgen'],
      reactDocgen: 'react-docgen',
      reason: 'typescript-without-compiler-api',
    });
    expect(builderDocgenPackages.prompt(result!)).toContain('TypeScript 6 side by side');
  });

  it('uses react-docgen on TypeScript 7 even when react-docgen-typescript is configured', async () => {
    const result = await check(
      {
        framework: '@storybook/react-vite',
        features: docgenServerOff,
        typescript: { reactDocgen: 'react-docgen-typescript' },
      },
      { typescript: '7.0.2' }
    );

    expect(result?.packages).toEqual(['react-docgen']);
  });

  it.each([
    ['TypeScript 6', { typescript: '^6.0.3' }],
    ['TypeScript 6 side by side with TypeScript 7', { typescript: '6.0.3' }],
    ['no TypeScript, which typescript-dependency adds', {}],
  ])('stays quiet on the docgen server with %s', async (_name, dependencies) => {
    await expect(check({ framework: '@storybook/react-vite' }, dependencies)).resolves.toBeNull();
  });

  it('skips packages the project already declares', async () => {
    await expect(
      check(
        { framework: '@storybook/react-vite', features: docgenServerOff },
        { typescript: '^6.0.3', 'react-docgen': '^8.0.2' }
      )
    ).resolves.toBeNull();
  });

  it('skips a project that disables docgen', async () => {
    await expect(
      check(
        {
          framework: '@storybook/react-vite',
          features: docgenServerOff,
          typescript: { reactDocgen: false },
        },
        { typescript: '^6.0.3' }
      )
    ).resolves.toBeNull();
  });

  it.each(['@storybook/vue3-vite', '@storybook/preact-vite'])('skips %s', async (framework) => {
    await expect(
      check({ framework, features: docgenServerOff }, { typescript: '7.0.2' })
    ).resolves.toBeNull();
  });

  it('skips an upgrade within Storybook 11', async () => {
    await expect(
      check(
        { framework: '@storybook/react-vite', features: docgenServerOff },
        { typescript: '^6.0.3' },
        { beforeVersion: '11.0.0', storybookVersion: '11.1.0' }
      )
    ).resolves.toBeNull();
  });

  it('adds the packages to devDependencies without installing', async () => {
    const packageManager = packageManagerWith({});

    await runFix(builderDocgenPackages, {
      result: {
        packages: ['@joshwooding/vite-plugin-react-docgen-typescript', 'react-docgen-typescript'],
        reactDocgen: 'react-docgen-typescript',
        reason: 'docgen-server-disabled',
      },
      packageManager,
      mainConfigPath: '/project/.storybook/main.ts',
      configDir: '/project/.storybook',
      storiesPaths: [],
      storybookVersion: '11.0.0',
    } as unknown as Omit<RunOptions<BuilderDocgenPackagesResult>, 'files'>);

    expect(packageManager.addDependencies).toHaveBeenCalledWith(
      { type: 'devDependencies', skipInstall: true },
      ['@joshwooding/vite-plugin-react-docgen-typescript@^0.7.0', 'react-docgen-typescript@^2.2.2']
    );
  });
});
