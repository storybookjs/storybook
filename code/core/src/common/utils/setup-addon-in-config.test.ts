import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConfigFile } from 'storybook/internal/csf-tools';
import * as csfTools from 'storybook/internal/csf-tools';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import * as loadMainConfigModule from './load-main-config';
import { setupAddonInConfig } from './setup-addon-in-config';
import * as syncModule from './sync-main-preview-addons';
import * as wrapUtils from './wrap-getAbsolutePath-utils';

vi.mock('storybook/internal/csf-tools', { spy: true });
vi.mock('./sync-main-preview-addons', { spy: true });
vi.mock('./wrap-getAbsolutePath-utils', { spy: true });
vi.mock('./load-main-config', { spy: true });

describe('setupAddonInConfig', () => {
  let mockMain: ConfigFile;
  let mockMainConfig: StorybookConfigRaw;

  beforeEach(() => {
    vi.clearAllMocks();

    mockMain = {
      getFieldNode: vi.fn(),
      valueToNode: vi.fn(),
      appendNodeToArray: vi.fn(),
      appendValueToArray: vi.fn(),
    } as any;

    mockMainConfig = {
      addons: [],
    } as any;

    vi.mocked(csfTools.writeConfig).mockResolvedValue();
    vi.mocked(syncModule.syncStorybookAddons).mockResolvedValue();
    vi.mocked(loadMainConfigModule.loadMainConfig).mockResolvedValue(mockMainConfig);
  });

  it('should add addon to main config when no getAbsolutePath wrapper exists', async () => {
    vi.mocked(mockMain.getFieldNode).mockReturnValue({} as any);
    vi.mocked(wrapUtils.getAbsolutePathWrapperName).mockReturnValue(null);

    await setupAddonInConfig({
      addonName: '@storybook/addon-docs',
      mainConfigCSFFile: mockMain,
      previewConfigPath: '.storybook/preview.ts',
      configDir: '.storybook',
    });

    expect(mockMain.appendValueToArray).toHaveBeenCalledWith(['addons'], '@storybook/addon-docs');
    expect(mockMain.appendNodeToArray).not.toHaveBeenCalled();
    expect(wrapUtils.wrapValueWithGetAbsolutePathWrapper).not.toHaveBeenCalled();
    expect(csfTools.writeConfig).toHaveBeenCalledWith(mockMain);
    expect(loadMainConfigModule.loadMainConfig).toHaveBeenCalledWith({
      configDir: '.storybook',
      skipCache: true,
    });
    expect(syncModule.syncStorybookAddons).toHaveBeenCalledWith(
      mockMainConfig,
      '.storybook/preview.ts',
      '.storybook'
    );
  });

  it('should add addon with getAbsolutePath wrapper when wrapper exists', async () => {
    const mockAddonNode = { type: 'StringLiteral' } as any;

    vi.mocked(mockMain.getFieldNode).mockReturnValue({} as any);
    vi.mocked(mockMain.valueToNode).mockReturnValue(mockAddonNode);
    vi.mocked(wrapUtils.getAbsolutePathWrapperName).mockReturnValue('getAbsolutePath');
    vi.mocked(wrapUtils.wrapValueWithGetAbsolutePathWrapper).mockImplementation(() => {});

    await setupAddonInConfig({
      addonName: '@storybook/addon-docs',
      mainConfigCSFFile: mockMain,
      previewConfigPath: '.storybook/preview.ts',
      configDir: '.storybook',
    });

    expect(mockMain.valueToNode).toHaveBeenCalledWith('@storybook/addon-docs');
    expect(mockMain.appendNodeToArray).toHaveBeenCalledWith(['addons'], mockAddonNode);
    expect(wrapUtils.wrapValueWithGetAbsolutePathWrapper).toHaveBeenCalledWith(
      mockMain,
      mockAddonNode
    );
    expect(mockMain.appendValueToArray).not.toHaveBeenCalled();
    expect(csfTools.writeConfig).toHaveBeenCalledWith(mockMain);
    expect(loadMainConfigModule.loadMainConfig).toHaveBeenCalledWith({
      configDir: '.storybook',
      skipCache: true,
    });
    expect(syncModule.syncStorybookAddons).toHaveBeenCalledWith(
      mockMainConfig,
      '.storybook/preview.ts',
      '.storybook'
    );
  });

  it('should write config even when addon field does not exist', async () => {
    vi.mocked(mockMain.getFieldNode).mockReturnValue(undefined);

    await setupAddonInConfig({
      addonName: '@storybook/addon-docs',
      mainConfigCSFFile: mockMain,
      previewConfigPath: '.storybook/preview.ts',
      configDir: '.storybook',
    });

    expect(mockMain.appendValueToArray).toHaveBeenCalledWith(['addons'], '@storybook/addon-docs');
    expect(csfTools.writeConfig).toHaveBeenCalledWith(mockMain);
  });

  it('should handle sync errors gracefully', async () => {
    vi.mocked(mockMain.getFieldNode).mockReturnValue(undefined);
    vi.mocked(syncModule.syncStorybookAddons).mockRejectedValue(new Error('Sync failed'));

    await expect(
      setupAddonInConfig({
        addonName: '@storybook/addon-docs',
        mainConfigCSFFile: mockMain,
        previewConfigPath: '.storybook/preview.ts',
        configDir: '.storybook',
      })
    ).resolves.not.toThrow();

    expect(csfTools.writeConfig).toHaveBeenCalledWith(mockMain);
    expect(syncModule.syncStorybookAddons).toHaveBeenCalled();
  });

  it('should handle undefined previewConfigPath', async () => {
    vi.mocked(mockMain.getFieldNode).mockReturnValue(undefined);

    await setupAddonInConfig({
      addonName: '@storybook/addon-docs',
      mainConfigCSFFile: mockMain,
      previewConfigPath: undefined,
      configDir: '.storybook',
    });

    expect(mockMain.appendValueToArray).toHaveBeenCalledWith(['addons'], '@storybook/addon-docs');
    expect(csfTools.writeConfig).toHaveBeenCalledWith(mockMain);
    // syncStorybookAddons will be called with undefined, which is fine
  });
});
