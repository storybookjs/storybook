import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { loadConfig, readConfig } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import { detectAgent } from 'storybook/internal/telemetry';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { add } from '../../add.ts';
import { checkFix } from '../helpers/fix-test-utils.ts';
import type { RunOptions } from '../types.ts';
import { addonMcp } from './addon-mcp.ts';

vi.mock('node:fs/promises', { spy: true });
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

  it('skips a main config that storybook add could not edit', async () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
    vi.mocked(readFile).mockResolvedValue('export default { ...baseConfig, stories: [] };');

    await expect(
      checkFix(addonMcp, { ...baseCheckOptions, mainConfigPath: '.storybook/main.ts' })
    ).resolves.toBeNull();
  });

  it('offers the addon for a main config that storybook add can edit', async () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
    vi.mocked(readFile).mockResolvedValue("export default { addons: ['@storybook/addon-links'] };");

    await expect(
      checkFix(addonMcp, { ...baseCheckOptions, mainConfigPath: '.storybook/main.ts' })
    ).resolves.toEqual({});
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
