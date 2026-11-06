import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type JsPackageManager,
  addReactDocgenFallback,
  readTypeScriptPackageForDocgen,
} from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import type { CheckOptions, RunOptions } from '../types.ts';
import { typescript7ReactDocgen } from './typescript-7-react-docgen.ts';

// TEMPORARY(ts-7.1): delete together with the fix.

vi.mock('storybook/internal/common', { spy: true });

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
  checkFix(typescript7ReactDocgen, {
    mainConfig: mainConfig as unknown as StorybookConfigRaw,
    packageManager: packageManagerWith(dependencies),
    ...versions,
  } as CheckOptions);

describe('typescript-7-react-docgen', () => {
  beforeEach(() => {
    // The fix runs until TypeScript 7.1 is stable, whatever the shell sets.
    vi.stubEnv('STORYBOOK_TYPESCRIPT_7_1_STABLE', 'false');
    vi.clearAllMocks();
    vi.mocked(addReactDocgenFallback).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it('applies within Storybook 11 when requested by id', async () => {
    await expect(
      check(
        { framework: '@storybook/react-vite' },
        { typescript: '~7.0.2' },
        { storybookVersion: '11.0.1', requested: true }
      )
    ).resolves.toBe(true);
  });

  it('adds react-docgen as a temporary fallback', async () => {
    const packageManager = packageManagerWith({ typescript: '~7.0.2' });

    await runFix(typescript7ReactDocgen, {
      result: true,
      packageManager,
      mainConfigPath: '/project/.storybook/main.ts',
      configDir: '/project/.storybook',
      storiesPaths: [],
      storybookVersion: '11.0.0',
    } as unknown as Omit<RunOptions<true>, 'files'>);

    expect(addReactDocgenFallback).toHaveBeenCalledExactlyOnceWith(packageManager);
  });

  it('skips a project on TypeScript 7.1, whose docgen runs on the native API', async () => {
    await expect(
      check({ framework: '@storybook/react-vite' }, { typescript: '7.1.0-beta' })
    ).resolves.toBeNull();
  });

  describe('when the main config sets typescript.docgenSpecifier', () => {
    const withSpecifier = {
      framework: '@storybook/react-vite',
      typescript: { docgenSpecifier: '@typescript/native' },
    };
    const inConfigDir = { ...upgrade, configDir: '/project/.storybook' };

    it('skips a project whose specifier names TypeScript 7.1, whatever typescript is', async () => {
      vi.mocked(readTypeScriptPackageForDocgen).mockReturnValue({
        version: '7.1.0',
        importEntry: async () => ({}),
      });

      await expect(check(withSpecifier, { typescript: '~7.0.2' }, inConfigDir)).resolves.toBeNull();
      expect(readTypeScriptPackageForDocgen).toHaveBeenCalledWith({
        specifier: '@typescript/native',
        configDir: '/project/.storybook',
      });
    });

    it('applies to a project whose specifier names TypeScript 7.0', async () => {
      vi.mocked(readTypeScriptPackageForDocgen).mockReturnValue({
        version: '7.0.2',
        importEntry: async () => ({}),
      });

      await expect(check(withSpecifier, { typescript: '^6.0.3' }, inConfigDir)).resolves.toBe(true);
    });
  });

  describe('once TypeScript 7.1 is stable', () => {
    beforeEach(() => {
      vi.stubEnv('STORYBOOK_TYPESCRIPT_7_1_STABLE', 'true');
    });

    it('skips a project on TypeScript 7.0, which typescript-native-api upgrades instead', async () => {
      await expect(
        check({ framework: '@storybook/react-vite' }, { typescript: '~7.0.2' })
      ).resolves.toBeNull();
    });
  });
});
