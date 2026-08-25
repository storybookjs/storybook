import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { detectAgent } from 'storybook/internal/telemetry';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { add } from '../../add.ts';
import type { CheckOptions, RunOptions } from '../types.ts';
import { type AddonMcpOptions, addonMcp } from './addon-mcp.ts';

vi.mock('../../add', { spy: true });
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
          agentName: 'claude',
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
