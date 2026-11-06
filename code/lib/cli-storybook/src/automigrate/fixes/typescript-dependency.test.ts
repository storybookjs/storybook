import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type JsPackageManager, readTypeScriptPackageForDocgen } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import type { CheckOptions, Fix, RunOptions } from '../types.ts';
import {
  typescriptCompilerApi,
  typescriptDependency,
  typescriptNativeApi,
} from './typescript-dependency.ts';

vi.mock('storybook/internal/common', { spy: true });

const packageManagerWith = (dependencies: Record<string, string>) =>
  ({
    isDependencyInstalled: (name: string) => name in dependencies,
    getDeclaredVersionSpecifier: async (name: string) => dependencies[name] ?? null,
    addDependencies: vi.fn().mockResolvedValue(undefined),
    upgradeDeclaredDependency: vi.fn(),
  }) as unknown as JsPackageManager;

const upgrade = { beforeVersion: '10.3.0', storybookVersion: '11.0.0' };

beforeEach(() => {
  vi.stubEnv('STORYBOOK_TYPESCRIPT_7_1_STABLE', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

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

describe('typescript-dependency prompt', () => {
  it('names no version before the check picks one for the renderer', () => {
    expect(typescriptDependency.prompt()).toContain('Add TypeScript to devDependencies');
  });
});

describe('typescript-native-api', () => {
  const checkTs = (framework: string, dependencies: Record<string, string>) =>
    checkFix(typescriptNativeApi, {
      mainConfig: { framework } as StorybookConfigRaw,
      packageManager: packageManagerWith(dependencies),
      ...upgrade,
    } as CheckOptions);

  it.each(['@storybook/react-vite', '@storybook/nextjs-vite'])(
    'offers a %s project on TypeScript 7.0 the upgrade to 7.1',
    async (framework) => {
      const result = await checkTs(framework, { typescript: '~7.0.2' });

      expect(result).toEqual({ version: '7.0.2', dependency: 'typescript@^7.1' });
      expect(typescriptNativeApi.prompt(result!)).toContain('typescript@^7.1');
    }
  );

  it.each([
    ['a React project on TypeScript 7.1', '@storybook/react-vite', '^7.1.0'],
    ['a React project on TypeScript 6', '@storybook/react-vite', '^6.0.3'],
    [
      'a Vue project on TypeScript 7.0, whose docgen 7.1 does not help',
      '@storybook/vue3-vite',
      '^7.0.2',
    ],
    ['an Angular project on TypeScript 7.0', '@storybook/angular-vite', '7.0.2'],
  ])('stays quiet for %s', async (_name, framework, typescript) => {
    await expect(checkTs(framework, { typescript })).resolves.toBeNull();
  });

  it('offers the upgrade to a project already on Storybook 11', async () => {
    const result = await checkFix(typescriptNativeApi, {
      mainConfig: { framework: '@storybook/react-vite' } as StorybookConfigRaw,
      packageManager: packageManagerWith({ typescript: '~7.0.2' }),
      beforeVersion: '11.0.0',
      storybookVersion: '11.1.0',
    } as CheckOptions);

    expect(result).not.toBeNull();
  });

  it('upgrades typescript to ^7.1 where the project declares it, without installing', async () => {
    const packageManager = packageManagerWith({ typescript: '~7.0.2' });

    await runFix(typescriptNativeApi, {
      result: { version: '7.0.2', dependency: 'typescript@^7.1' },
      packageManager,
      mainConfigPath: '/project/.storybook/main.ts',
      configDir: '/project/.storybook',
      storiesPaths: [],
      storybookVersion: '11.0.0',
    } as unknown as Omit<RunOptions<{ version: string; dependency: string }>, 'files'>);

    expect(packageManager.upgradeDeclaredDependency).toHaveBeenCalledWith('typescript@^7.1');
    expect(packageManager.addDependencies).not.toHaveBeenCalled();
  });
});

describe('typescript-compiler-api', () => {
  const checkTs = (framework: string, dependencies: Record<string, string>) =>
    checkFix(typescriptCompilerApi, {
      mainConfig: { framework } as StorybookConfigRaw,
      packageManager: packageManagerWith(dependencies),
      ...upgrade,
    } as CheckOptions);

  it('leaves a React project on TypeScript 7.0 to typescript-native-api', async () => {
    await expect(checkTs('@storybook/react-vite', { typescript: '^7.0.2' })).resolves.toBeNull();
  });

  it('notifies a Vue project on TypeScript 7 with the side-by-side setup', async () => {
    const result = await checkTs('@storybook/vue3-vite', { typescript: '^7.0.2' });

    expect(result).toEqual({ version: '7.0.2' });
    expect(typescriptCompilerApi.prompt(result!)).toContain(
      '"typescript": "npm:@typescript/typescript6@^6.0.2"'
    );
  });

  it('notifies a Vue project on TypeScript 7.1, which only React docgen can use', async () => {
    await expect(checkTs('@storybook/vue3-vite', { typescript: '^7.1.0' })).resolves.toEqual({
      version: '7.1.0',
    });
  });

  it('shows the two lines on upgrade, which prints a prompt only when it differs from the hint', async () => {
    const result = await checkTs('@storybook/vue3-vite', { typescript: '7.0.2' });

    expect(typescriptCompilerApi.prompt(result!)).not.toBe(typescriptCompilerApi.prompt());
  });

  it('notifies an Angular project on TypeScript 7', async () => {
    await expect(checkTs('@storybook/angular-vite', { typescript: '7.0.2' })).resolves.toEqual({
      version: '7.0.2',
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

describe('when the main config sets typescript.docgenSpecifier', () => {
  const checkWithSpecifier = <Result>(fix: Fix<Result>, framework: string) =>
    checkFix(fix, {
      mainConfig: {
        framework,
        typescript: { docgenSpecifier: '@typescript/native' },
      } as StorybookConfigRaw,
      packageManager: packageManagerWith({ typescript: '~7.0.2' }),
      configDir: '/project/.storybook',
      ...upgrade,
    } as CheckOptions);

  beforeEach(() => {
    vi.mocked(readTypeScriptPackageForDocgen).mockReturnValue({
      version: '7.1.0',
      packageDir: '/project/node_modules/@typescript/native',
    });
  });

  it('does not upgrade typescript, which docgen does not load', async () => {
    await expect(
      checkWithSpecifier(typescriptNativeApi, '@storybook/react-vite')
    ).resolves.toBeNull();
  });

  it.each(['@storybook/react-vite', '@storybook/angular-vite'])(
    'does not notify a %s project about typescript',
    async (framework) => {
      await expect(checkWithSpecifier(typescriptCompilerApi, framework)).resolves.toBeNull();
    }
  );
});

describe('before TypeScript 7.1 is stable', () => {
  beforeEach(() => {
    vi.stubEnv('STORYBOOK_TYPESCRIPT_7_1_STABLE', 'false');
  });

  const checkFixWith = <Result>(
    fix: Fix<Result>,
    framework: string,
    dependencies: Record<string, string>
  ) =>
    checkFix(fix, {
      mainConfig: { framework } as StorybookConfigRaw,
      packageManager: packageManagerWith(dependencies),
      ...upgrade,
    } as CheckOptions);

  it('adds typescript@^6 to a React project without TypeScript', async () => {
    await expect(checkFixWith(typescriptDependency, '@storybook/react-vite', {})).resolves.toEqual({
      dependency: 'typescript@^6',
    });
  });

  it('does not offer TypeScript 7.1, which installs nothing yet', async () => {
    await expect(
      checkFixWith(typescriptNativeApi, '@storybook/react-vite', { typescript: '~7.0.2' })
    ).resolves.toBeNull();
  });

  it('notifies a React project on TypeScript 7.0 with the side-by-side setup', async () => {
    const result = await checkFixWith(typescriptCompilerApi, '@storybook/react-vite', {
      typescript: '~7.0.2',
    });

    expect(typescriptCompilerApi.prompt(result!)).toContain(
      '"typescript": "npm:@typescript/typescript6@^6.0.2"'
    );
  });
});
