import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { detectAgent } from 'storybook/internal/telemetry';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { add } from '../../add.ts';
import { checkFix } from '../helpers/fix-test-utils.ts';
import type { RunOptions } from '../types.ts';
import { addonMcp } from './addon-mcp.ts';

vi.mock('../../add', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });

const mockPackageManager = { type: 'npm' } as JsPackageManager;

const baseCheckOptions = {
  packageManager: mockPackageManager,
  mainConfig: {
    stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
    addons: ['@storybook/addon-links'],
  } as StorybookConfigRaw,
  storybookVersion: '9.0.0',
  configDir: '.storybook',
  storiesPaths: [],
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

  it('does not apply without an AI agent', async () => {
    vi.mocked(detectAgent).mockReturnValue(undefined);
    await expect(checkFix(addonMcp, baseCheckOptions)).resolves.toBeNull();
  });

  it('applies when an AI agent runs the upgrade', async () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
    await expect(checkFix(addonMcp, baseCheckOptions)).resolves.toEqual({});
  });

  it('adds @storybook/addon-mcp without installing', async () => {
    await addonMcp.run?.({
      packageManager: mockPackageManager,
      configDir: '.storybook',
    } as RunOptions<object>);

    expect(vi.mocked(add)).toHaveBeenCalledWith(
      '@storybook/addon-mcp',
      addArgs,
      expect.objectContaining({ log: logger.debug })
    );
  });
});
