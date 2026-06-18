import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { add } from '../../add.ts';
import type { CheckOptions, RunOptions } from '../types.ts';
import { type AddonMcpOptions, addonMcp } from './addon-mcp.ts';

vi.mock('../../add');

const { detectAgent } = vi.hoisted(() => ({ detectAgent: vi.fn() }));
vi.mock('storybook/internal/telemetry', () => ({ detectAgent }));

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

describe('addon-mcp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    detectAgent.mockReset();
  });

  describe('check phase', () => {
    it('returns null when no AI agent is detected', async () => {
      detectAgent.mockReturnValue(undefined);

      const result = await addonMcp.check(baseCheckOptions);

      expect(result).toBeNull();
    });

    it('returns the agent name when an agent is detected and addon-mcp is missing', async () => {
      detectAgent.mockReturnValue({ name: 'claude' });

      const result = await addonMcp.check(baseCheckOptions);

      expect(result).toEqual({ agentName: 'claude' });
    });

    it('returns null when addon-mcp is already configured', async () => {
      detectAgent.mockReturnValue({ name: 'claude' });

      const result = await addonMcp.check({
        ...baseCheckOptions,
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: ['@storybook/addon-links', '@storybook/addon-mcp'],
        } as StorybookConfigRaw,
      });

      expect(result).toBeNull();
    });

    it('returns null when addon-mcp is configured as an object', async () => {
      detectAgent.mockReturnValue({ name: 'cursor' });

      const result = await addonMcp.check({
        ...baseCheckOptions,
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: [{ name: '@storybook/addon-mcp' }],
        } as StorybookConfigRaw,
      });

      expect(result).toBeNull();
    });
  });

  describe('run phase', () => {
    it('installs @storybook/addon-mcp without a redundant install', async () => {
      await addonMcp.run?.({
        result: { agentName: 'claude' },
        packageManager: mockPackageManager,
        configDir: '.storybook',
      } as RunOptions<AddonMcpOptions>);

      expect(vi.mocked(add)).toHaveBeenCalledWith('@storybook/addon-mcp', {
        configDir: '.storybook',
        packageManager: 'npm',
        skipInstall: true,
        skipPostinstall: true,
        yes: true,
      });
    });

    it('does nothing in dry run mode', async () => {
      await addonMcp.run?.({
        result: { agentName: 'claude' },
        packageManager: mockPackageManager,
        configDir: '.storybook',
        dryRun: true,
      } as RunOptions<AddonMcpOptions>);

      expect(vi.mocked(add)).not.toHaveBeenCalled();
    });
  });
});
