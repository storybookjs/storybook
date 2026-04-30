import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import * as storybookCommon from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { rnOndeviceAddonsToDeviceAddons } from './rn-ondevice-addons-to-device-addons.ts';

// vi.hoisted ensures these are available when vi.mock factories run (before module imports)
const mocks = vi.hoisted(() => {
  const addonsNode = { type: 'ArrayExpression', __mock: 'addons-node' };
  const configFile = {
    getFieldNode: vi.fn(),
    setFieldNode: vi.fn(),
    removeField: vi.fn(),
  };
  const updateMainConfig = vi.fn();
  return {
    addonsNode,
    configFile,
    updateMainConfig,
    /** When set, `existsSync` in the automigrate fix uses this instead of the real fs (ESM-safe). */
    existsSyncOverride: null as null | ((p: string) => boolean),
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: (p: Parameters<typeof actual.existsSync>[0]) =>
      mocks.existsSyncOverride != null ? mocks.existsSyncOverride(String(p)) : actual.existsSync(p),
  };
});

vi.mock('../helpers/mainConfigFile', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../helpers/mainConfigFile')>();
  return {
    ...mod,
    updateMainConfig: mocks.updateMainConfig,
  };
});

vi.mock('storybook/internal/common', async (importOriginal) => {
  const mod = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...mod,
    findConfigFile: vi.fn(() => undefined),
    loadMainConfig: vi.fn(),
  };
});

const makePackageManager = (allDeps: Record<string, string>) =>
  ({
    getAllDependencies: () => allDeps,
  }) as unknown as JsPackageManager;

describe('rn-ondevice-addons-to-device-addons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.existsSyncOverride = null;
    vi.mocked(storybookCommon.findConfigFile).mockImplementation(() => undefined);
    vi.mocked(storybookCommon.loadMainConfig).mockReset();
    mocks.configFile.getFieldNode.mockImplementation((path: string[]) =>
      path[0] === 'addons' ? mocks.addonsNode : undefined
    );
    mocks.updateMainConfig.mockImplementation(
      async (
        _opts: { mainConfigPath: string; dryRun: boolean },
        callback: (cfg: unknown) => Promise<void>
      ) => {
        await callback(mocks.configFile);
      }
    );
  });

  describe('check', () => {
    it('returns null when @storybook/react-native is not installed', async () => {
      const packageManager = makePackageManager({});
      const mainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: ['@storybook/addon-ondevice-controls', '@storybook/addon-ondevice-actions'],
      };

      const result = await rnOndeviceAddonsToDeviceAddons.check({
        packageManager,
        mainConfig,
        mainConfigPath: join(process.cwd(), '.rnstorybook', 'main.ts'),
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toBeNull();
    });

    it('returns null when there are no addons at all', async () => {
      const packageManager = makePackageManager({
        '@storybook/react-native': '^8.0.0',
      });
      const mainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
      };

      const result = await rnOndeviceAddonsToDeviceAddons.check({
        packageManager,
        mainConfig,
        mainConfigPath: join(process.cwd(), '.rnstorybook', 'main.ts'),
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toBeNull();
    });

    it('returns null when `deviceAddons` is already present (idempotency)', async () => {
      const packageManager = makePackageManager({
        '@storybook/react-native': '^8.0.0',
      });
      const mainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: ['@storybook/addon-docs'],
        deviceAddons: ['@storybook/addon-ondevice-controls'],
      } as StorybookConfigRaw;

      const result = await rnOndeviceAddonsToDeviceAddons.check({
        packageManager,
        mainConfig,
        mainConfigPath: join(process.cwd(), '.rnstorybook', 'main.ts'),
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toBeNull();
    });

    it('returns target when `addons` exists in `.rnstorybook/main.ts` (string entries)', async () => {
      const packageManager = makePackageManager({
        '@storybook/react-native': '^8.0.0',
      });
      const mainConfigPath = join(process.cwd(), '.rnstorybook', 'main.ts');
      const mainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: [
          '@storybook/addon-ondevice-controls',
          '@storybook/addon-ondevice-actions',
          '@storybook/addon-docs',
        ],
      };

      const result = await rnOndeviceAddonsToDeviceAddons.check({
        packageManager,
        mainConfig,
        mainConfigPath,
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toEqual({ targets: [{ mainConfigPath }] });
    });

    it('returns target when `addons` contains object-form entries in `.rnstorybook/main.ts`', async () => {
      const packageManager = makePackageManager({
        '@storybook/react-native': '^8.0.0',
      });
      const mainConfigPath = join(process.cwd(), '.rnstorybook', 'main.ts');
      const mainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: [
          {
            name: '@storybook/addon-ondevice-controls',
            options: { expanded: true },
          },
        ],
      };

      const result = await rnOndeviceAddonsToDeviceAddons.check({
        packageManager,
        mainConfig,
        mainConfigPath,
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toEqual({ targets: [{ mainConfigPath }] });
    });

    it('migrates `.storybook/main.ts` when its framework is `@storybook/react-native`', async () => {
      const packageManager = makePackageManager({
        '@storybook/react-native': '^8.0.0',
      });
      const mainConfigPath = join(process.cwd(), '.storybook', 'main.ts');
      const mainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
        framework: '@storybook/react-native',
        addons: ['@storybook/addon-ondevice-controls'],
      };

      const result = await rnOndeviceAddonsToDeviceAddons.check({
        packageManager,
        mainConfig,
        mainConfigPath,
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toEqual({ targets: [{ mainConfigPath }] });
    });

    it('skips a `.storybook/main.ts` whose framework is `@storybook/react-native-web-vite` while migrating the paired `.rnstorybook/main.ts`', async () => {
      mocks.existsSyncOverride = (p) => p.includes('.rnstorybook');

      const storybookMainPath = join(process.cwd(), '.storybook', 'main.ts');
      const rnMainPath = join(process.cwd(), '.rnstorybook', 'main.ts');
      vi.mocked(storybookCommon.findConfigFile).mockImplementation((prefix, dir) => {
        if (prefix === 'main' && String(dir).endsWith('.storybook')) {
          return storybookMainPath;
        }
        if (prefix === 'main' && String(dir).includes('.rnstorybook')) {
          return rnMainPath;
        }
        return storybookCommon.findConfigFile(prefix, dir);
      });

      vi.mocked(storybookCommon.loadMainConfig).mockResolvedValue({
        stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: ['@storybook/addon-ondevice-controls'],
      });

      const packageManager = makePackageManager({
        '@storybook/react-native': '^8.0.0',
      });
      const webMainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
        framework: '@storybook/react-native-web-vite',
        addons: ['@storybook/addon-docs'],
      };

      const result = await rnOndeviceAddonsToDeviceAddons.check({
        packageManager,
        mainConfig: webMainConfig,
        mainConfigPath: storybookMainPath,
        configDir: '.storybook',
        storybookVersion: '9.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toEqual({ targets: [{ mainConfigPath: rnMainPath }] });
      expect(storybookCommon.loadMainConfig).toHaveBeenCalledWith({
        configDir: join(process.cwd(), '.rnstorybook'),
      });
    });
  });

  describe('run', () => {
    it('renames the whole `addons` field to `deviceAddons`', async () => {
      await rnOndeviceAddonsToDeviceAddons.run?.({
        result: {
          targets: [{ mainConfigPath: '.rnstorybook/main.ts' }],
        },
        dryRun: false,
        mainConfigPath: '.rnstorybook/main.ts',
        mainConfig: {} as StorybookConfigRaw,
        packageManager: {} as any,
        configDir: '.rnstorybook',
        storybookVersion: '8.0.0',
        storiesPaths: [],
      });

      expect(mocks.configFile.getFieldNode).toHaveBeenCalledWith(['addons']);
      expect(mocks.configFile.setFieldNode).toHaveBeenCalledTimes(1);
      expect(mocks.configFile.setFieldNode).toHaveBeenCalledWith(
        ['deviceAddons'],
        mocks.addonsNode
      );
      expect(mocks.configFile.removeField).toHaveBeenCalledTimes(1);
      expect(mocks.configFile.removeField).toHaveBeenCalledWith(['addons']);
    });

    it('does nothing when `addons` is missing in the parsed AST', async () => {
      mocks.configFile.getFieldNode.mockImplementation(() => undefined);

      await rnOndeviceAddonsToDeviceAddons.run?.({
        result: {
          targets: [{ mainConfigPath: '.rnstorybook/main.ts' }],
        },
        dryRun: false,
        mainConfigPath: '.rnstorybook/main.ts',
        mainConfig: {} as StorybookConfigRaw,
        packageManager: {} as any,
        configDir: '.rnstorybook',
        storybookVersion: '8.0.0',
        storiesPaths: [],
      });

      expect(mocks.configFile.setFieldNode).not.toHaveBeenCalled();
      expect(mocks.configFile.removeField).not.toHaveBeenCalled();
    });

    it('passes dryRun flag to updateMainConfig', async () => {
      await rnOndeviceAddonsToDeviceAddons.run?.({
        result: {
          targets: [{ mainConfigPath: '.rnstorybook/main.ts' }],
        },
        dryRun: true,
        mainConfigPath: '.rnstorybook/main.ts',
        mainConfig: {} as StorybookConfigRaw,
        packageManager: {} as any,
        configDir: '.rnstorybook',
        storybookVersion: '8.0.0',
        storiesPaths: [],
      });

      expect(mocks.updateMainConfig).toHaveBeenCalledWith(
        { mainConfigPath: '.rnstorybook/main.ts', dryRun: true },
        expect.any(Function)
      );
    });

    it('runs updateMainConfig once per target when multiple mains need changes', async () => {
      await rnOndeviceAddonsToDeviceAddons.run?.({
        result: {
          targets: [
            { mainConfigPath: '.storybook/main.ts' },
            { mainConfigPath: '.rnstorybook/main.ts' },
          ],
        },
        dryRun: false,
        mainConfigPath: '.storybook/main.ts',
        mainConfig: {} as StorybookConfigRaw,
        packageManager: {} as any,
        configDir: '.storybook',
        storybookVersion: '8.0.0',
        storiesPaths: [],
      });

      expect(mocks.updateMainConfig).toHaveBeenCalledTimes(2);
      expect(mocks.updateMainConfig).toHaveBeenNthCalledWith(
        1,
        { mainConfigPath: '.storybook/main.ts', dryRun: false },
        expect.any(Function)
      );
      expect(mocks.updateMainConfig).toHaveBeenNthCalledWith(
        2,
        { mainConfigPath: '.rnstorybook/main.ts', dryRun: false },
        expect.any(Function)
      );
    });
  });
});
