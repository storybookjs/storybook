import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import type { CheckOptions, RunOptions } from '../types.ts';
import { typescriptCompilerApi, typescriptDependency } from './typescript-dependency.ts';

const packageManagerWith = (dependencies: Record<string, string>) =>
  ({
    isDependencyInstalled: (name: string) => name in dependencies,
    getDeclaredVersionSpecifier: async (name: string) => dependencies[name] ?? null,
    addDependencies: vi.fn().mockResolvedValue(undefined),
  }) as unknown as JsPackageManager;

const upgrade = { beforeVersion: '10.3.0', storybookVersion: '11.0.0' };

const check = (framework: string, packageManager: JsPackageManager, versions = upgrade) =>
  checkFix(typescriptDependency, {
    mainConfig: { framework } as StorybookConfigRaw,
    packageManager,
    ...versions,
  } as CheckOptions);

describe('typescript-dependency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['@storybook/react-vite', 'typescript@^7.1'],
    ['@storybook/nextjs-vite', 'typescript@^7.1'],
    ['@storybook/vue3-vite', 'typescript@^6'],
    ['@storybook/svelte-vite', 'typescript@^6'],
    ['@storybook/sveltekit', 'typescript@^6'],
    ['@storybook/web-components-vite', 'typescript@^6'],
  ])('applies to a %s project without typescript, adding %s', async (framework, dependency) => {
    await expect(check(framework, packageManagerWith({}))).resolves.toEqual({ dependency });
  });

  it('skips an upgrade within Storybook 11', async () => {
    await expect(
      check('@storybook/react-vite', packageManagerWith({}), {
        beforeVersion: '11.0.0',
        storybookVersion: '11.1.0',
      })
    ).resolves.toBeNull();
  });

  it('applies within Storybook 11 when requested by id', async () => {
    await expect(
      checkFix(typescriptDependency, {
        mainConfig: { framework: '@storybook/react-vite' } as StorybookConfigRaw,
        packageManager: packageManagerWith({}),
        storybookVersion: '11.1.0',
        requested: true,
      } as CheckOptions)
    ).resolves.toEqual({ dependency: 'typescript@^7.1' });
  });

  it('skips a project that already depends on typescript', async () => {
    await expect(
      check('@storybook/react-vite', packageManagerWith({ typescript: '^5.9.3' }))
    ).resolves.toBeNull();
  });

  it.each(['@storybook/preact-vite', '@storybook/html-vite', '@storybook/angular-vite'])(
    'skips %s, which has no TypeScript docgen peer',
    async (framework) => {
      await expect(check(framework, packageManagerWith({}))).resolves.toBeNull();
    }
  );

  it('adds the typescript dependency to devDependencies without installing', async () => {
    const packageManager = packageManagerWith({});

    await runFix(typescriptDependency, {
      result: { dependency: 'typescript@^6' },
      packageManager,
      mainConfigPath: '/project/.storybook/main.ts',
      configDir: '/project/.storybook',
      storiesPaths: [],
      storybookVersion: '11.0.0',
    } as unknown as Omit<RunOptions<{ dependency: string }>, 'files'>);

    expect(packageManager.addDependencies).toHaveBeenCalledWith(
      { type: 'devDependencies', skipInstall: true },
      ['typescript@^6']
    );
  });
});

describe('typescript-compiler-api', () => {
  const checkTs = (framework: string, dependencies: Record<string, string>) =>
    checkFix(typescriptCompilerApi, {
      mainConfig: { framework } as StorybookConfigRaw,
      packageManager: packageManagerWith(dependencies),
      ...upgrade,
    } as CheckOptions);

  it('tells a React project on TypeScript 7.0 to upgrade to 7.1', async () => {
    const result = await checkTs('@storybook/react-vite', { typescript: '^7.0.2' });

    expect(result).toEqual({ version: '7.0.2', nativeApiSupported: true });
    expect(typescriptCompilerApi.prompt(result!)).toContain('typescript@^7.1');
    expect(typescriptCompilerApi.prompt(result!)).not.toContain('@typescript/native');
  });

  it('notifies a Vue project on TypeScript 7 with the side-by-side setup', async () => {
    const result = await checkTs('@storybook/vue3-vite', { typescript: '^7.0.2' });

    expect(result).toEqual({ version: '7.0.2', nativeApiSupported: false });
    expect(typescriptCompilerApi.prompt(result!)).toContain(
      '"typescript": "npm:@typescript/typescript6@^6.0.2"'
    );
  });

  it('notifies a Vue project on TypeScript 7.1, which only React docgen can use', async () => {
    await expect(checkTs('@storybook/vue3-vite', { typescript: '^7.1.0' })).resolves.toEqual({
      version: '7.1.0',
      nativeApiSupported: false,
    });
  });

  it('shows the two lines on upgrade, which prints a prompt only when it differs from the hint', async () => {
    const result = await checkTs('@storybook/vue3-vite', { typescript: '7.0.2' });

    expect(typescriptCompilerApi.prompt(result!)).not.toBe(typescriptCompilerApi.prompt());
  });

  it('notifies an Angular project on TypeScript 7', async () => {
    await expect(checkTs('@storybook/angular-vite', { typescript: '7.0.2' })).resolves.toEqual({
      version: '7.0.2',
      nativeApiSupported: false,
    });
  });

  it.each([
    ['TypeScript 6', { typescript: '^6.0.3' }],
    ['TypeScript 7.1', { typescript: '^7.1.0' }],
    ['no TypeScript', {}],
  ])('stays quiet for a React project with %s', async (_name, dependencies) => {
    await expect(checkTs('@storybook/react-vite', dependencies)).resolves.toBeNull();
  });

  it('stays quiet for a renderer without TypeScript docgen', async () => {
    await expect(checkTs('@storybook/preact-vite', { typescript: '^7.0.2' })).resolves.toBeNull();
  });
});
