import { cp, mkdir, rm } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JsPackageManagerFactory } from 'storybook/internal/common';
import type { InstallationMetadata, JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { Builder } from 'storybook/internal/types';

import { vol } from 'memfs';

import { buildStaticStandalone } from './build-static.ts';
import type { BuildStaticStandaloneOptions } from './build-static.ts';
import { getBuilders } from './utils/get-builders.ts';
import { writeIndexJson } from './utils/index-json.ts';

const { presets } = vi.hoisted(() => ({
  presets: {
    apply: vi.fn(async (name: string) =>
      ['core', 'build', 'features'].includes(name) ? {} : undefined
    ),
  },
}));

vi.mock('node:fs/promises', { spy: true });

vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...actual,
    loadMainConfig: vi.fn(async () => ({ framework: '@storybook/react-vite' })),
    loadAllPresets: vi.fn(async () => presets),
    JsPackageManagerFactory: { getPackageManager: vi.fn() },
  };
});

vi.mock('storybook/internal/node-logger');

vi.mock('../shared/utils/module.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../shared/utils/module.ts')>()),
  resolvePackageDir: vi.fn(() => '/storybook'),
}));

vi.mock('./utils/apply-services-preset-once.ts', () => ({
  applyServicesPresetOnce: vi.fn(async () => {}),
}));
vi.mock('./utils/get-builders.ts', () => ({ getBuilders: vi.fn() }));
vi.mock('./utils/index-json.ts', () => ({ writeIndexJson: vi.fn() }));
vi.mock('./utils/metadata.ts', () => ({ extractStorybookMetadata: vi.fn(async () => {}) }));

const installations = (versions: Record<string, string>): InstallationMetadata => ({
  dependencies: Object.fromEntries(
    Object.entries(versions).map(([name, version]) => [name, [{ version }]])
  ),
  duplicatedDependencies: {},
  infoCommand: 'npm ls --depth=1',
  dedupeCommand: 'npm dedupe',
});

const mismatched = installations({
  storybook: '10.2.1',
  '@storybook/react-vite': '10.2.0',
  '@storybook/builder-vite': '10.2.0',
});

const findInstallations = vi.fn();
const previewBuild = vi.fn();

const build = () =>
  buildStaticStandalone({
    configDir: '/project/.storybook',
    outputDir: '/project/storybook-static',
    packageJson: {},
    test: true,
  } as BuildStaticStandaloneOptions);

const warnings = () => vi.mocked(logger.warn).mock.calls.map(([message]) => String(message));
const mismatchHint = 'There seems to be a mismatch between your Storybook package versions';

const previewError = new Error('Could not resolve entry module "mocker-runtime.template.js"');

describe('buildStaticStandalone', () => {
  beforeEach(async () => {
    const memfs = await vi.importActual<typeof import('memfs')>('memfs');
    vi.mocked(rm).mockImplementation(
      memfs.fs.promises.rm as unknown as typeof import('node:fs/promises').rm
    );
    vi.mocked(mkdir).mockImplementation(
      memfs.fs.promises.mkdir as unknown as typeof import('node:fs/promises').mkdir
    );
    vi.mocked(cp).mockImplementation(
      memfs.fs.promises.cp as unknown as typeof import('node:fs/promises').cp
    );
    vol.fromNestedJSON({ '/storybook/assets/browser/favicon.svg': '<svg />' });

    vi.stubGlobal('FEATURES', undefined);
    vi.mocked(writeIndexJson).mockResolvedValue(undefined);
    vi.mocked(JsPackageManagerFactory.getPackageManager).mockReturnValue({
      findInstallations,
    } as unknown as JsPackageManager);
    vi.mocked(getBuilders).mockResolvedValue([
      { build: previewBuild } as unknown as Builder<unknown>,
      { build: vi.fn(async () => {}) } as unknown as Builder<unknown>,
    ]);
  });

  afterEach(() => {
    vol.reset();
    vi.unstubAllGlobals();
    process.exitCode = undefined;
  });

  it('warns about mismatching Storybook versions and rethrows when the preview build fails', async () => {
    previewBuild.mockRejectedValue(previewError);
    findInstallations.mockResolvedValue(mismatched);

    await expect(build()).rejects.toBe(previewError);

    expect(process.exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalledWith('Failed to build the preview');
    expect(warnings()).toContainEqual(expect.stringContaining(mismatchHint));
    expect(warnings()).toContainEqual(expect.stringContaining('npx storybook doctor'));
  });

  it('does not warn when the Storybook versions match and the preview build fails', async () => {
    previewBuild.mockRejectedValue(previewError);
    findInstallations.mockResolvedValue(
      installations({
        storybook: '10.2.1',
        '@storybook/react-vite': '10.2.1',
        '@storybook/builder-vite': '10.2.1',
      })
    );

    await expect(build()).rejects.toBe(previewError);

    expect(process.exitCode).toBe(1);
    expect(findInstallations).toHaveBeenCalled();
    expect(warnings()).not.toContainEqual(expect.stringContaining(mismatchHint));
  });

  it('rethrows the preview error when the package manager cannot be detected', async () => {
    previewBuild.mockRejectedValue(previewError);
    vi.mocked(JsPackageManagerFactory.getPackageManager).mockImplementation(() => {
      throw new Error('Unable to find a usable package manager');
    });

    await expect(build()).rejects.toBe(previewError);

    expect(process.exitCode).toBe(1);
    expect(warnings()).not.toContainEqual(expect.stringContaining(mismatchHint));
  });

  it('rethrows the preview error when another build step fails while versions are being checked', async () => {
    const indexError = new Error('Unable to index stories');
    let failIndex: (error: Error) => void = () => {};
    vi.mocked(writeIndexJson).mockReturnValue(
      new Promise((_, reject) => {
        failIndex = reject;
      })
    );
    previewBuild.mockRejectedValue(previewError);
    findInstallations.mockImplementation(async () => {
      failIndex(indexError);
      await new Promise((resolve) => setTimeout(resolve, 0));
      return mismatched;
    });

    await expect(build()).rejects.toBe(previewError);

    expect(warnings()).toContainEqual(expect.stringContaining(mismatchHint));
  });

  it('rethrows a build step error that fails before the preview without checking versions', async () => {
    const indexError = new Error('Unable to index stories');
    vi.mocked(writeIndexJson).mockRejectedValue(indexError);
    previewBuild.mockReturnValue(new Promise(() => {}));

    await expect(build()).rejects.toBe(indexError);

    expect(JsPackageManagerFactory.getPackageManager).not.toHaveBeenCalled();
  });

  it('does not check versions when the preview build succeeds', async () => {
    previewBuild.mockResolvedValue(undefined);

    await expect(build()).resolves.toBeUndefined();

    expect(JsPackageManagerFactory.getPackageManager).not.toHaveBeenCalled();
    expect(vol.existsSync('/project/storybook-static/favicon.svg')).toBe(true);
  });
});
