import { cp, mkdir, rm } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JsPackageManagerFactory, loadAllPresets, loadMainConfig } from 'storybook/internal/common';
import type { InstallationMetadata, JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { getPrecedingUpgrade, telemetry } from 'storybook/internal/telemetry';
import type { Builder, Presets } from 'storybook/internal/types';

import { vol } from 'memfs';

import { getRegisteredServices } from '../shared/open-service/server.ts';
import { resolvePackageDir } from '../shared/utils/module.ts';
import { buildStaticStandalone } from './build-static.ts';
import type { BuildStaticStandaloneOptions } from './build-static.ts';
import { applyServicesPresetOnce } from './utils/apply-services-preset-once.ts';
import { getBuilders } from './utils/get-builders.ts';
import { writeIndexJson } from './utils/index-json.ts';
import { extractStorybookMetadata } from './utils/metadata.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });
vi.mock('../shared/open-service/server.ts', { spy: true });
vi.mock('../shared/utils/module.ts', { spy: true });
vi.mock('./utils/apply-services-preset-once.ts', { spy: true });
vi.mock('./utils/get-builders.ts', { spy: true });
vi.mock('./utils/index-json.ts', { spy: true });
vi.mock('./utils/metadata.ts', { spy: true });

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

const aligned = installations({
  storybook: '10.2.1',
  '@storybook/react-vite': '10.2.1',
  '@storybook/builder-vite': '10.2.1',
});

const presets = { apply: vi.fn() };
const findInstallations = vi.fn();
const previewBuild = vi.fn();
const managerBuild = vi.fn();

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
const indexError = new Error('Unable to index stories');

describe('buildStaticStandalone', () => {
  beforeEach(async () => {
    vi.resetAllMocks();

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

    for (const method of ['step', 'info', 'warn', 'error', 'trace', 'debug'] as const) {
      vi.mocked(logger[method]).mockImplementation(() => {});
    }
    vi.mocked(telemetry).mockResolvedValue(undefined);
    vi.mocked(getPrecedingUpgrade).mockResolvedValue(undefined);

    presets.apply.mockImplementation(async (name: string) =>
      ['core', 'build', 'features'].includes(name) ? {} : undefined
    );
    vi.mocked(loadMainConfig).mockResolvedValue({
      stories: [],
      framework: '@storybook/react-vite',
    });
    vi.mocked(loadAllPresets).mockResolvedValue(presets as unknown as Presets);
    vi.mocked(resolvePackageDir).mockReturnValue('/storybook');
    vi.mocked(applyServicesPresetOnce).mockResolvedValue(undefined);
    vi.mocked(getRegisteredServices).mockReturnValue([]);
    vi.mocked(writeIndexJson).mockResolvedValue(undefined);
    vi.mocked(extractStorybookMetadata).mockResolvedValue(undefined);

    previewBuild.mockResolvedValue(undefined);
    managerBuild.mockResolvedValue(undefined);
    vi.mocked(getBuilders).mockResolvedValue([
      { build: previewBuild } as unknown as Builder<unknown>,
      { build: managerBuild } as unknown as Builder<unknown>,
    ]);

    findInstallations.mockResolvedValue(mismatched);
    vi.mocked(JsPackageManagerFactory.getPackageManager).mockReturnValue({
      findInstallations,
    } as unknown as JsPackageManager);

    vi.stubGlobal('FEATURES', undefined);
  });

  afterEach(() => {
    vol.reset();
    vi.unstubAllGlobals();
    process.exitCode = undefined;
  });

  describe('when the preview build succeeds', () => {
    it('does not check versions', async () => {
      await expect(build()).resolves.toBeUndefined();

      expect(JsPackageManagerFactory.getPackageManager).not.toHaveBeenCalled();
      expect(vol.existsSync('/project/storybook-static/favicon.svg')).toBe(true);
    });
  });

  describe('when another build step fails before the preview build settles', () => {
    beforeEach(() => {
      vi.mocked(writeIndexJson).mockRejectedValue(indexError);
      previewBuild.mockReturnValue(new Promise(() => {}));
    });

    it('rethrows that error without checking versions', async () => {
      await expect(build()).rejects.toBe(indexError);

      expect(JsPackageManagerFactory.getPackageManager).not.toHaveBeenCalled();
    });
  });

  describe('when the preview build fails', () => {
    beforeEach(() => {
      previewBuild.mockRejectedValue(previewError);
    });

    describe('and the Storybook versions are mismatched', () => {
      it('warns about the mismatch and rethrows the preview error', async () => {
        await expect(build()).rejects.toBe(previewError);

        expect(process.exitCode).toBe(1);
        expect(logger.error).toHaveBeenCalledWith('Failed to build the preview');
        expect(warnings()).toContainEqual(expect.stringContaining(mismatchHint));
        expect(warnings()).toContainEqual(expect.stringContaining('npx storybook doctor'));
      });
    });

    describe('and the Storybook versions match', () => {
      beforeEach(() => {
        findInstallations.mockResolvedValue(aligned);
      });

      it('does not warn and rethrows the preview error', async () => {
        await expect(build()).rejects.toBe(previewError);

        expect(process.exitCode).toBe(1);
        expect(findInstallations).toHaveBeenCalled();
        expect(warnings()).not.toContainEqual(expect.stringContaining(mismatchHint));
      });
    });

    describe('and the package manager cannot be detected', () => {
      beforeEach(() => {
        vi.mocked(JsPackageManagerFactory.getPackageManager).mockImplementation(() => {
          throw new Error('Unable to find a usable package manager');
        });
      });

      it('rethrows the preview error', async () => {
        await expect(build()).rejects.toBe(previewError);

        expect(process.exitCode).toBe(1);
        expect(warnings()).not.toContainEqual(expect.stringContaining(mismatchHint));
      });
    });

    describe('and another build step fails while versions are being checked', () => {
      beforeEach(() => {
        let failIndex: (error: Error) => void = () => {};
        vi.mocked(writeIndexJson).mockReturnValue(
          new Promise((_, reject) => {
            failIndex = reject;
          })
        );
        findInstallations.mockImplementation(async () => {
          failIndex(indexError);
          await new Promise((resolve) => setTimeout(resolve, 0));
          return mismatched;
        });
      });

      it('still rethrows the preview error', async () => {
        await expect(build()).rejects.toBe(previewError);

        expect(warnings()).toContainEqual(expect.stringContaining(mismatchHint));
      });
    });
  });
});
