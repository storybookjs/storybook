import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getProjectRoot } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import type { TransformOptions } from '@babel/core';
import type { Configuration as WebpackConfig } from 'webpack';

import { configureBabelLoader } from './babel/loader.ts';
import nextBabelPreset from './babel/preset.ts';
import { babel, webpackFinal } from './preset.ts';
import { configureSWCLoader } from './swc/loader.ts';
import type { FrameworkOptions } from './types.ts';

// The global test setup stubs package resolution; the preset reads the real Next.js version.
vi.mock('../../../core/src/shared/utils/module.ts', async (importOriginal) => importOriginal());

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  getProjectRoot: vi.fn(),
}));

// Only the compiler choice matters here, not the Next.js config or the loaders themselves.
vi.mock('./config/webpack.ts', () => ({ configureConfig: vi.fn(async () => ({})) }));
vi.mock('./swc/loader.ts', () => ({ configureSWCLoader: vi.fn() }));
vi.mock('./babel/loader.ts', () => ({ configureBabelLoader: vi.fn() }));

let projectRoot: string;

const storybookOptions = (frameworkOptions: FrameworkOptions = {}) =>
  ({
    configType: 'DEVELOPMENT',
    configDir: join(projectRoot, '.storybook'),
    presets: {
      apply: vi.fn(async (name: string) => (name === 'frameworkOptions' ? frameworkOptions : {})),
    },
  }) as unknown as Options;

const runBabel = (frameworkOptions?: FrameworkOptions) =>
  (babel as (config: TransformOptions, options: Options) => Promise<TransformOptions>)(
    {},
    storybookOptions(frameworkOptions)
  );

const runWebpackFinal = async (frameworkOptions?: FrameworkOptions) => {
  vi.mocked(configureSWCLoader).mockClear();
  vi.mocked(configureBabelLoader).mockClear();
  const baseConfig: WebpackConfig = { module: { rules: [] }, plugins: [], resolve: {} };
  await webpackFinal!(baseConfig, storybookOptions(frameworkOptions));
  if (vi.mocked(configureBabelLoader).mock.calls.length) {
    return 'babel';
  }
  return vi.mocked(configureSWCLoader).mock.calls.length ? 'swc' : undefined;
};

const writeUserBabelConfig = async (dir: string) => {
  await writeFile(
    join(dir, 'noop-plugin.cjs'),
    "module.exports = () => ({ name: 'noop-plugin', visitor: {} });"
  );
  await writeFile(
    join(dir, 'babel.config.mjs'),
    "export default { presets: ['next/babel'], plugins: ['./noop-plugin.cjs'] };"
  );
};

const expectUserBabelConfig = (config: TransformOptions) => {
  expect(config.babelrc).toBe(false);
  expect(config.configFile).toBe(false);
  expect(config.plugins).toContainEqual(
    expect.objectContaining({ file: expect.objectContaining({ request: './noop-plugin.cjs' }) })
  );
  // `next/babel` is replaced by Storybook's copy of the Next.js preset
  const presetNames = config.presets?.map((preset) => (Array.isArray(preset) ? preset[0] : preset));
  expect(presetNames).toEqual([nextBabelPreset]);
};

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'sb-nextjs-preset-'));
  // Let the project config resolve `next/babel` the way a real Next.js project would.
  const nextDir = dirname(fileURLToPath(import.meta.resolve('next/package.json')));
  await mkdir(join(projectRoot, 'node_modules'));
  await mkdir(join(projectRoot, '.storybook'));
  await symlink(nextDir, join(projectRoot, 'node_modules', 'next'), 'dir');
  vi.mocked(getProjectRoot).mockReturnValue(projectRoot);
  // Babel looks up `babel.config.*` in the current working directory, the project root
  vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);
});

afterEach(async () => {
  vi.mocked(process.cwd).mockRestore();
  await rm(projectRoot, { recursive: true, force: true });
});

describe('single-package project', () => {
  it('loads an ESM babel.config.mjs and keeps the user plugins', async () => {
    await writeUserBabelConfig(projectRoot);

    expectUserBabelConfig(await runBabel());
  });

  it('uses Babel when the project root has a Babel config', async () => {
    await writeUserBabelConfig(projectRoot);

    expect(await runWebpackFinal()).toBe('babel');
  });

  it('uses SWC without a Babel config', async () => {
    await writeFile(join(projectRoot, 'next.config.js'), 'module.exports = {};');

    expect(await runWebpackFinal()).toBe('swc');
  });
});

describe('monorepo with the Next.js app in a subfolder', () => {
  let appDir: string;

  beforeEach(async () => {
    // `.git` at the repo root makes it the project root, as `getProjectRoot()` would
    await mkdir(join(projectRoot, '.git'));
    appDir = join(projectRoot, 'apps', 'web');
    await mkdir(appDir, { recursive: true });
    await writeFile(join(appDir, 'next.config.js'), 'module.exports = {};');
  });

  describe.each([
    { name: 'started from the app folder', startInApp: true, passNextConfigPath: false },
    {
      name: 'started from the repo root with nextConfigPath',
      startInApp: false,
      passNextConfigPath: true,
    },
  ])('$name', ({ startInApp, passNextConfigPath }) => {
    const options = (): FrameworkOptions =>
      passNextConfigPath ? { nextConfigPath: join(appDir, 'next.config.js') } : {};

    beforeEach(() => {
      if (startInApp) {
        vi.mocked(process.cwd).mockReturnValue(appDir);
      }
    });

    it('uses Babel with babel.config.mjs in the app folder', async () => {
      await writeUserBabelConfig(appDir);

      expect(await runWebpackFinal(options())).toBe('babel');
    });

    it('uses Babel with .babelrc in the app folder', async () => {
      await writeFile(join(appDir, '.babelrc'), JSON.stringify({ presets: ['next/babel'] }));

      expect(await runWebpackFinal(options())).toBe('babel');
    });

    it('loads the app-level babel.config.mjs and keeps the user plugins', async () => {
      await writeUserBabelConfig(appDir);

      expectUserBabelConfig(await runBabel(options()));
    });

    it('uses SWC without a Babel config', async () => {
      expect(await runWebpackFinal(options())).toBe('swc');
    });
  });
});
