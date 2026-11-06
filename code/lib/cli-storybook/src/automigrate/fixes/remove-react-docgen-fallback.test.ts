import * as fsPromises from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type JsPackageManager, readTypeScriptPackageForDocgen } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { fs as memfs, vol } from 'memfs';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import type { CheckOptions, RunOptions } from '../types.ts';
import { removeReactDocgenFallback } from './remove-react-docgen-fallback.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const RECORD = '/project/node_modules/.cache/storybook/temporary-dependencies.json';
const FALLBACK = { 'react-docgen': 'typescript-7.0-docgen-fallback' };

// `dependencies` are the devDependencies of the package.json that holds the Storybook config.
const packageManagerWith = (dependencies: Record<string, string>) =>
  ({
    primaryPackageJson: {
      packageJson: { name: 'app', devDependencies: dependencies },
      operationDir: '/project',
    },
    getDeclaredVersionSpecifier: async (name: string) => dependencies[name] ?? null,
    writePackageJson: vi.fn(),
  }) as unknown as JsPackageManager;

const onTypeScript71 = { typescript: '~7.1.0', 'react-docgen': '^8.0.2' };

const check = (
  dependencies: Record<string, string>,
  mainConfig: Record<string, unknown> = { framework: '@storybook/react-vite' }
) =>
  checkFix(removeReactDocgenFallback, {
    mainConfig: mainConfig as unknown as StorybookConfigRaw,
    configDir: '/project/.storybook',
    packageManager: packageManagerWith(dependencies),
  } as CheckOptions);

const record = (content: Record<string, string>) =>
  vol.fromJSON({ [RECORD]: JSON.stringify(content) });

beforeEach(() => {
  // TypeScript 7.1 is stable for these tests unless a test says otherwise.
  vi.stubEnv('STORYBOOK_TYPESCRIPT_7_1_STABLE', 'true');
  vol.reset();
  vi.mocked(fsPromises.readFile).mockImplementation(memfs.promises.readFile as never);
  vi.mocked(fsPromises.writeFile).mockImplementation(memfs.promises.writeFile as never);
  vi.mocked(fsPromises.unlink).mockImplementation(memfs.promises.unlink as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('remove-react-docgen-fallback', () => {
  it.each(['~7.1.0', '^6.0.3', '5.9.3'])(
    'applies to a project on TypeScript %s with the react-docgen Storybook added',
    async (typescript) => {
      record(FALLBACK);

      await expect(check({ ...onTypeScript71, typescript })).resolves.not.toBeNull();
    }
  );

  describe('before TypeScript 7.1 is stable', () => {
    beforeEach(() => {
      vi.stubEnv('STORYBOOK_TYPESCRIPT_7_1_STABLE', 'false');
      record(FALLBACK);
    });

    it('keeps the fallback, which typescript-7-react-docgen still adds', async () => {
      await expect(check(onTypeScript71)).resolves.toBeNull();
    });
  });

  it.each([
    ['without the record, so react-docgen may be the user own', () => {}],
    [
      'with a react-docgen the record lists for another reason',
      () => record({ 'react-docgen': 'other' }),
    ],
  ])('skips a project %s', async (_name, setUp) => {
    setUp();

    await expect(check(onTypeScript71)).resolves.toBeNull();
  });

  it('skips a project that no longer declares react-docgen', async () => {
    record(FALLBACK);

    await expect(check({ typescript: '~7.1.0' })).resolves.toBeNull();
  });

  it('skips a project whose react-docgen another package.json declares, such as a monorepo root', async () => {
    record(FALLBACK);
    const packageManager = {
      ...packageManagerWith({ typescript: '~7.1.0' }),
      getDeclaredVersionSpecifier: async (name: string) =>
        ({ typescript: '~7.1.0', 'react-docgen': '^8.0.2' })[name] ?? null,
    } as unknown as JsPackageManager;

    await expect(
      checkFix(removeReactDocgenFallback, {
        mainConfig: { framework: '@storybook/react-vite' } as unknown as StorybookConfigRaw,
        configDir: '/project/.storybook',
        packageManager,
      } as CheckOptions)
    ).resolves.toBeNull();
  });

  it('skips a project still on TypeScript 7.0', async () => {
    record(FALLBACK);

    await expect(check({ ...onTypeScript71, typescript: '~7.0.2' })).resolves.toBeNull();
  });

  it.each([
    ['docgenServer: false', { docgenServer: false }],
    ['experimentalDocgenServer: false', { experimentalDocgenServer: false }],
  ])(
    'skips a project whose main config sets %s, which needs react-docgen',
    async (_name, features) => {
      record(FALLBACK);

      await expect(
        check(onTypeScript71, { framework: '@storybook/react-vite', features })
      ).resolves.toBeNull();
    }
  );

  describe('when the main config sets typescript.docgenSpecifier', () => {
    const withSpecifier = {
      framework: '@storybook/react-vite',
      typescript: { docgenSpecifier: '@typescript/native' },
    };

    beforeEach(() => {
      record(FALLBACK);
    });

    describe('to TypeScript 7.1', () => {
      beforeEach(() => {
        vi.mocked(readTypeScriptPackageForDocgen).mockReturnValue({
          version: '7.1.0',
          importEntry: async () => ({}),
        });
      });

      it('applies, whatever typescript is', async () => {
        await expect(check(onTypeScript71, withSpecifier)).resolves.not.toBeNull();
        expect(readTypeScriptPackageForDocgen).toHaveBeenCalledWith({
          specifier: '@typescript/native',
          configDir: '/project/.storybook',
        });
      });
    });

    describe('to TypeScript 7.0', () => {
      beforeEach(() => {
        vi.mocked(readTypeScriptPackageForDocgen).mockReturnValue({
          version: '7.0.2',
          importEntry: async () => ({}),
        });
      });

      it('skips, because docgen still needs react-docgen', async () => {
        await expect(
          check({ ...onTypeScript71, typescript: '^6.0.3' }, withSpecifier)
        ).resolves.toBeNull();
      });
    });

    describe('to a package that is not installed', () => {
      beforeEach(() => {
        vi.mocked(readTypeScriptPackageForDocgen).mockImplementation(() => {
          throw new Error('not installed');
        });
      });

      it('skips', async () => {
        await expect(check(onTypeScript71, withSpecifier)).resolves.toBeNull();
      });
    });
  });

  const migrate = async (recorded: Record<string, string>) => {
    record(recorded);
    const packageManager = packageManagerWith(onTypeScript71);
    const result = await checkFix(removeReactDocgenFallback, {
      mainConfig: { framework: '@storybook/react-vite' } as unknown as StorybookConfigRaw,
      configDir: '/project/.storybook',
      packageManager,
    } as CheckOptions);
    await runFix(removeReactDocgenFallback, {
      result: result!,
      packageManager,
      mainConfig: { framework: '@storybook/react-vite' },
      storiesPaths: [],
    } as unknown as Omit<RunOptions<NonNullable<typeof result>>, 'files'>);
    return packageManager;
  };

  it('removes react-docgen and the record', async () => {
    const packageManager = await migrate(FALLBACK);

    expect(packageManager.writePackageJson).toHaveBeenCalledExactlyOnceWith(
      { name: 'app', devDependencies: { typescript: '~7.1.0' } },
      '/project'
    );
    expect(vol.existsSync(RECORD)).toBe(false);
  });

  it('keeps the other temporary dependencies recorded', async () => {
    await migrate({ ...FALLBACK, 'some-package': 'another-reason' });

    expect(vol.readFileSync(RECORD, 'utf8')).toMatchInlineSnapshot(`
      "{
        "some-package": "another-reason"
      }"
    `);
  });
});
