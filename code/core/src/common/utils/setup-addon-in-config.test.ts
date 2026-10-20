import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConfigFile } from 'storybook/internal/csf-tools';
import * as csfTools from 'storybook/internal/csf-tools';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import * as loadMainConfigModule from './load-main-config.ts';
import { setupAddonInConfig } from './setup-addon-in-config.ts';
import * as syncModule from './sync-main-preview-addons.ts';
import * as wrapUtils from './wrap-getAbsolutePath-utils.ts';

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
      editor: { quote: "'" },
      getBodyDeclarations: () => [],
      _arrayAt: vi.fn(() => ({ kind: 'missing' })),
      append: vi.fn(() => ({ ok: true, changed: true })),
    } as any;

    mockMainConfig = {
      addons: [],
    } as any;

    vi.mocked(csfTools.writeConfig).mockResolvedValue();
    vi.mocked(syncModule.syncStorybookAddons).mockResolvedValue();
    vi.mocked(loadMainConfigModule.loadMainConfig).mockResolvedValue(mockMainConfig);
  });

  it('should add addon to main config when no getAbsolutePath wrapper exists', async () => {
    vi.mocked(mockMain._arrayAt).mockReturnValue({ kind: 'array', node: {} as any });
    vi.mocked(wrapUtils.getAbsolutePathWrapperName).mockReturnValue(null);

    await setupAddonInConfig({
      addonName: '@storybook/addon-docs',
      mainConfigCSFFile: mockMain,
      previewConfigPath: '.storybook/preview.ts',
      configDir: '.storybook',
    });

    expect(mockMain.append).toHaveBeenCalledWith(['addons'], '@storybook/addon-docs');
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
    vi.mocked(mockMain._arrayAt).mockReturnValue({ kind: 'array', node: {} as any });
    vi.mocked(wrapUtils.getAbsolutePathWrapperName).mockReturnValue('getAbsolutePath');

    await setupAddonInConfig({
      addonName: '@storybook/addon-docs',
      mainConfigCSFFile: mockMain,
      previewConfigPath: '.storybook/preview.ts',
      configDir: '.storybook',
    });

    const [path, node] = vi.mocked(mockMain.append).mock.calls[0];
    expect(path).toEqual(['addons']);
    expect(csfTools.textOf(node as csfTools.ESTreeNode)).toBe(
      "getAbsolutePath('@storybook/addon-docs')"
    );
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
    vi.mocked(mockMain._arrayAt).mockReturnValue({ kind: 'missing' });

    await setupAddonInConfig({
      addonName: '@storybook/addon-docs',
      mainConfigCSFFile: mockMain,
      previewConfigPath: '.storybook/preview.ts',
      configDir: '.storybook',
    });

    expect(mockMain.append).toHaveBeenCalledWith(['addons'], '@storybook/addon-docs');
    expect(csfTools.writeConfig).toHaveBeenCalledWith(mockMain);
  });

  it('throws without writing when the addons field is not an array', async () => {
    const diagnostic = {
      message: "Expected an array literal or a call at 'addons', got 'Identifier'",
    };
    vi.mocked(mockMain.append).mockReturnValue({
      ok: false,
      changed: false,
      diagnostic,
    } as any);

    await expect(
      setupAddonInConfig({
        addonName: '@storybook/addon-docs',
        mainConfigCSFFile: mockMain,
        previewConfigPath: undefined,
        configDir: '.storybook',
      })
    ).rejects.toThrow(diagnostic.message);
    expect(csfTools.writeConfig).not.toHaveBeenCalled();
  });

  it('throws without writing for an addons field that holds a call, not an array', async () => {
    const main = csfTools.loadConfig("export default { addons: ['a'].filter(Boolean) };").parse();

    await expect(
      setupAddonInConfig({
        addonName: '@storybook/addon-docs',
        mainConfigCSFFile: main,
        previewConfigPath: undefined,
        configDir: '.storybook',
      })
    ).rejects.toThrow("Expected an array literal at 'addons', got 'CallExpression'");
    expect(csfTools.writeConfig).not.toHaveBeenCalled();
    expect(csfTools.printConfig(main).code).toBe(
      "export default { addons: ['a'].filter(Boolean) };"
    );
  });

  it('should handle sync errors gracefully', async () => {
    vi.mocked(mockMain._arrayAt).mockReturnValue({ kind: 'missing' });
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
    vi.mocked(mockMain._arrayAt).mockReturnValue({ kind: 'missing' });

    await setupAddonInConfig({
      addonName: '@storybook/addon-docs',
      mainConfigCSFFile: mockMain,
      previewConfigPath: undefined,
      configDir: '.storybook',
    });

    expect(mockMain.append).toHaveBeenCalledWith(['addons'], '@storybook/addon-docs');
    expect(csfTools.writeConfig).toHaveBeenCalledWith(mockMain);
    // syncStorybookAddons will be called with undefined, which is fine
  });
});
