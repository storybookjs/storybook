import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import * as storybookCommon from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import * as memfs from 'memfs';
import { vol } from 'memfs';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { rnOndeviceAddonsToDeviceAddons } from './rn-ondevice-addons-to-device-addons.ts';

const mocks = vi.hoisted(() => ({
  existsSyncOverride: null as null | ((p: string) => boolean),
}));

// Restored after each test so Vitest can still write inline snapshots to the real test file.
vi.mock('node:fs/promises', { spy: true });

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: (p: Parameters<typeof actual.existsSync>[0]) =>
      mocks.existsSyncOverride != null ? mocks.existsSyncOverride(String(p)) : actual.existsSync(p),
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
    vi.mocked(storybookCommon.findConfigFile).mockImplementation(() => null);
    vi.mocked(storybookCommon.loadMainConfig).mockReset();
    vol.reset();
    vi.mocked(readFile).mockImplementation(
      memfs.fs.promises.readFile as unknown as typeof readFile
    );
    vi.mocked(writeFile).mockImplementation(
      memfs.fs.promises.writeFile as unknown as typeof writeFile
    );
  });

  afterEach(() => {
    vi.mocked(readFile).mockRestore();
    vi.mocked(writeFile).mockRestore();
  });

  describe('check', () => {
    it('returns null when @storybook/react-native is not installed', async () => {
      const packageManager = makePackageManager({});
      const mainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: ['@storybook/addon-ondevice-controls', '@storybook/addon-ondevice-actions'],
      };

      const result = await checkFix(rnOndeviceAddonsToDeviceAddons, {
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

      const result = await checkFix(rnOndeviceAddonsToDeviceAddons, {
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

      const result = await checkFix(rnOndeviceAddonsToDeviceAddons, {
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

      const result = await checkFix(rnOndeviceAddonsToDeviceAddons, {
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

      const result = await checkFix(rnOndeviceAddonsToDeviceAddons, {
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

      const result = await checkFix(rnOndeviceAddonsToDeviceAddons, {
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
        return null;
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

      const result = await checkFix(rnOndeviceAddonsToDeviceAddons, {
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
    const runOptions = {
      mainConfigPath: '/project/.storybook/main.ts',
      mainConfig: {} as StorybookConfigRaw,
      packageManager: {} as JsPackageManager,
      configDir: '/project/.storybook',
      storybookVersion: '8.0.0',
      storiesPaths: [],
    };

    it('renames the whole `addons` field to `deviceAddons` in every target', async () => {
      vol.fromJSON({
        '/project/.storybook/main.ts': `export default { addons: ['@storybook/addon-ondevice-controls'] };`,
        '/project/.rnstorybook/main.ts': `export default { addons: ['@storybook/addon-ondevice-actions'] };`,
      });

      await runFix(rnOndeviceAddonsToDeviceAddons, {
        ...runOptions,
        result: {
          targets: [
            { mainConfigPath: '/project/.storybook/main.ts' },
            { mainConfigPath: '/project/.rnstorybook/main.ts' },
          ],
        },
      });

      expect(vol.toJSON()).toMatchInlineSnapshot(`
        {
          "/project/.rnstorybook/main.ts": "export default { deviceAddons: ['@storybook/addon-ondevice-actions'] };",
          "/project/.storybook/main.ts": "export default { deviceAddons: ['@storybook/addon-ondevice-controls'] };",
        }
      `);
    });
  });
});
