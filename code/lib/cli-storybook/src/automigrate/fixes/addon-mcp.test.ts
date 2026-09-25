import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { detectAgent } from 'storybook/internal/telemetry';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { add } from '../../add.ts';
import type { CheckOptions, RunOptions } from '../types.ts';
import { type AddonMcpOptions, addonMcp } from './addon-mcp.ts';

vi.mock('../../add', { spy: true });
vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  writeFile: vi.fn(),
}));
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });

const mockPackageManager = { type: 'npm' } as JsPackageManager;

const baseCheckOptions: CheckOptions = {
  packageManager: mockPackageManager,
  mainConfig: {
    stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
    addons: ['@storybook/addon-links'],
  } as StorybookConfigRaw,
  storybookVersion: '9.0.0',
  configDir: '.storybook',
  storiesPaths: [],
  hasCsfFactoryPreview: false,
};

const addArgs = {
  configDir: '.storybook',
  packageManager: 'npm',
  skipInstall: true,
  skipPostinstall: true,
  yes: true,
};

describe('addon-mcp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(add).mockResolvedValue(undefined);
  });

  describe('check phase', () => {
    describe('when no AI agent is detected', () => {
      beforeEach(() => {
        vi.mocked(detectAgent).mockReturnValue(undefined);
      });

      it('returns null', async () => {
        await expect(addonMcp.check(baseCheckOptions)).resolves.toBeNull();
      });
    });

    describe('when an AI agent is detected', () => {
      beforeEach(() => {
        vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
      });

      it('returns isInstalled: false when addon-mcp is missing', async () => {
        await expect(addonMcp.check(baseCheckOptions)).resolves.toEqual({
          addGetAbsolutePathWrapper: false,
          agentName: 'claude',
          isConfigTypescript: false,
          isInstalled: false,
        });
      });

      it('returns isInstalled: true when addon-mcp is configured as a string', async () => {
        await expect(
          addonMcp.check({
            ...baseCheckOptions,
            mainConfig: {
              stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
              addons: ['@storybook/addon-links', '@storybook/addon-mcp'],
            } as StorybookConfigRaw,
          })
        ).resolves.toEqual({ agentName: 'claude', isInstalled: true });
      });

      it('returns isInstalled: true when addon-mcp is configured as an object', async () => {
        await expect(
          addonMcp.check({
            ...baseCheckOptions,
            mainConfig: {
              stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
              addons: [{ name: '@storybook/addon-mcp' }],
            } as StorybookConfigRaw,
          })
        ).resolves.toEqual({ agentName: 'claude', isInstalled: true });
      });
    });
  });

  describe('run phase', () => {
    it('installs @storybook/addon-mcp when it is missing', async () => {
      await addonMcp.run?.({
        result: { agentName: 'claude', isInstalled: false },
        packageManager: mockPackageManager,
        configDir: '.storybook',
      } as RunOptions<AddonMcpOptions>);

      expect(vi.mocked(add)).toHaveBeenCalledWith('@storybook/addon-mcp', addArgs);
    });

    it('adds the wrapper before installing into an agent-run monorepo', async () => {
      const mainConfigPath = require.resolve('./__test__/main-config-with-custom-resolver.ts');
      const result = await addonMcp.check({
        ...baseCheckOptions,
        packageManager: {
          ...mockPackageManager,
          isStorybookInMonorepo: () => true,
        } as JsPackageManager,
        mainConfigPath,
      });

      expect(result).toEqual({
        addGetAbsolutePathWrapper: true,
        agentName: 'claude',
        isConfigTypescript: true,
        isInstalled: false,
      });

      await addonMcp.run?.({
        result,
        packageManager: mockPackageManager,
        configDir: '.storybook',
        mainConfigPath,
      } as RunOptions<AddonMcpOptions>);

      const writeFile = vi.mocked((await import('node:fs/promises')).writeFile);
      expect(writeFile.mock.calls[0][1]).toMatchInlineSnapshot(`
        "import { fileURLToPath } from 'node:url';
        import { dirname } from 'node:path';
        import { resolvePackage } from './resolve-package.ts';

        export default {
          framework: resolvePackage('@storybook/react-vite'),
        };

        function getAbsolutePath(value: string): any {
          return dirname(fileURLToPath(import.meta.resolve(\`\${value}/package.json\`)));
        }
        "
      `);
      expect(vi.mocked(add)).toHaveBeenCalledWith('@storybook/addon-mcp', addArgs);
    });

    it('force-updates @storybook/addon-mcp to latest when it is already installed', async () => {
      await addonMcp.run?.({
        result: { agentName: 'claude', isInstalled: true },
        packageManager: mockPackageManager,
        configDir: '.storybook',
      } as RunOptions<AddonMcpOptions>);

      expect(vi.mocked(add)).toHaveBeenCalledWith('@storybook/addon-mcp', addArgs);
    });

    it('does nothing in dry run mode', async () => {
      await addonMcp.run?.({
        result: { agentName: 'claude', isInstalled: false },
        packageManager: mockPackageManager,
        configDir: '.storybook',
        dryRun: true,
      } as RunOptions<AddonMcpOptions>);

      expect(vi.mocked(add)).not.toHaveBeenCalled();
    });
  });
});
