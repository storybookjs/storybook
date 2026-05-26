import path from 'path';

import { syncStorybookAddons, type JsPackageManager } from 'storybook/internal/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runCodemod } from '../automigrate/codemod.ts';
import {
  csfFactories,
  getStorybookSubpathImportTarget,
  getUpdatedStorybookImportsMap,
} from './csf-factories.ts';
import { configToCsfFactory } from './helpers/config-to-csf-factory.ts';
import { storyToCsfFactory } from './helpers/story-to-csf-factory.ts';

vi.mock('../automigrate/codemod.ts', { spy: true });
vi.mock('./helpers/story-to-csf-factory.ts', { spy: true });
vi.mock('./helpers/config-to-csf-factory.ts', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const createPackageManager = (packageJsonImports: Record<string, unknown>): JsPackageManager =>
  ({
    primaryPackageJson: {
      packageJson: { imports: packageJsonImports },
      packageJsonPath: '/monorepo/packages/example/package.json',
      operationDir: '/monorepo/packages/example',
    },
    runPackageCommand: vi.fn(),
    writePackageJson: vi.fn(),
  }) as unknown as JsPackageManager;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.IN_STORYBOOK_SANDBOX = '1';
  vi.mocked(runCodemod).mockResolvedValue(undefined);
  vi.mocked(storyToCsfFactory).mockResolvedValue('transformed story');
  vi.mocked(configToCsfFactory).mockResolvedValue('transformed config');
  vi.mocked(syncStorybookAddons).mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.IN_STORYBOOK_SANDBOX;
});

describe('csf-factories command', () => {
  describe('getStorybookSubpathImportTarget', () => {
    it('scopes the imports map target to the Storybook config directory', () => {
      const packageJsonDir = path.resolve(path.sep, 'project');

      expect(
        getStorybookSubpathImportTarget(path.join(packageJsonDir, '.storybook'), packageJsonDir)
      ).toBe('./.storybook/*');
      expect(
        getStorybookSubpathImportTarget(
          path.join(packageJsonDir, 'config', 'storybook'),
          packageJsonDir
        )
      ).toBe('./config/storybook/*');
    });

    it('resolves relative config directories from the package.json directory', () => {
      const packageJsonDir = path.resolve('/repo', 'packages', 'app');

      expect(getStorybookSubpathImportTarget('.storybook', packageJsonDir)).toBe('./.storybook/*');
      expect(getStorybookSubpathImportTarget('../shared/.storybook', packageJsonDir)).toBe(
        './../shared/.storybook/*'
      );
    });
  });

  describe('getUpdatedStorybookImportsMap', () => {
    it('adds the scoped Storybook import target and removes the legacy wildcard', () => {
      const result = getUpdatedStorybookImportsMap(
        {
          '#*': ['./*', './*.ts', './*.tsx', './*.js', './*.jsx'],
        },
        './.storybook/*'
      );

      expect(result).toEqual({
        imports: {
          '#storybook/*': './.storybook/*',
        },
        shouldWritePackageJson: true,
      });
    });

    it('replaces stale scoped Storybook import targets on reruns', () => {
      const result = getUpdatedStorybookImportsMap(
        {
          '#storybook/*': './storybook/*',
        },
        './.storybook/*'
      );

      expect(result).toEqual({
        imports: {
          '#storybook/*': './.storybook/*',
        },
        shouldWritePackageJson: true,
      });
    });

    it('keeps current scoped Storybook import targets unchanged', () => {
      const result = getUpdatedStorybookImportsMap(
        {
          '#storybook/*': './.storybook/*',
        },
        './.storybook/*'
      );

      expect(result).toEqual({
        imports: {
          '#storybook/*': './.storybook/*',
        },
        shouldWritePackageJson: false,
      });
    });
  });

  it('passes a package-operation-dir-normalized configDir into story transformation helpers', async () => {
    const mockRunCodemod = vi.mocked(runCodemod);
    const mockStoryToCsfFactory = vi.mocked(storyToCsfFactory);
    const packageManager = createPackageManager({});

    await csfFactories.run({
      dryRun: false,
      packageManager,
      mainConfig: {},
      mainConfigPath: 'main.ts',
      previewConfigPath: 'preview.ts',
      configDir: '.storybook',
      yes: true,
      glob: '**/*.stories.tsx',
    });

    const transformStory = mockRunCodemod.mock.calls[0]?.[1];
    expect(transformStory).toBeDefined();

    await transformStory({
      path: 'src/stories/Button.stories.tsx',
      source: 'export {};',
    });

    expect(mockStoryToCsfFactory).toHaveBeenCalledWith(
      { path: 'src/stories/Button.stories.tsx', source: 'export {};' },
      expect.objectContaining({
        configDir: path.resolve('/monorepo/packages/example', '.storybook'),
        previewConfigPath: path.resolve('/monorepo/packages/example', 'preview.ts'),
      })
    );
  });

  it('refreshes #storybook/* when stale and removes legacy entries in package.json', async () => {
    const packageManager = createPackageManager({
      '#storybook/*': './old/*',
      '#*': ['./*', './*.ts', './*.tsx', './*.js', './*.jsx'],
    });
    await csfFactories.run({
      dryRun: false,
      packageManager,
      mainConfig: {},
      mainConfigPath: 'main.ts',
      previewConfigPath: 'preview.ts',
      configDir: '.storybook',
      yes: true,
      glob: '**/*.stories.tsx',
    });

    expect(packageManager.writePackageJson).toHaveBeenCalledWith(
      expect.objectContaining({
        imports: expect.objectContaining({
          '#storybook/*': './.storybook/*',
        }),
      }),
      '/monorepo/packages/example'
    );
    expect(packageManager.writePackageJson).toHaveBeenCalledTimes(1);
    expect(packageManager.primaryPackageJson.packageJson.imports['#*']).toBeUndefined();
  });
});
