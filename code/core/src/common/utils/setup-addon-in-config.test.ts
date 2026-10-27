import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as csfTools from 'storybook/internal/csf-tools';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import * as loadMainConfigModule from './load-main-config.ts';
import { setupAddonInConfig } from './setup-addon-in-config.ts';
import * as syncModule from './sync-main-preview-addons.ts';

vi.mock('storybook/internal/csf-tools', { spy: true });
vi.mock('./sync-main-preview-addons', { spy: true });
vi.mock('./load-main-config', { spy: true });

const WRAPPER = 'function getAbsolutePath(value) {\n  return value;\n}\n';

describe('setupAddonInConfig', () => {
  const mainConfig = { addons: [] } as unknown as StorybookConfigRaw;

  const setup = (source: string, previewConfigPath?: string) => {
    const main = csfTools.loadConfig(source).parse();
    const done = setupAddonInConfig({
      addonName: '@storybook/addon-docs',
      mainConfigCSFFile: main,
      previewConfigPath,
      configDir: '.storybook',
    });
    return { main, done };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(csfTools.writeConfig).mockResolvedValue();
    vi.mocked(syncModule.syncStorybookAddons).mockResolvedValue();
    vi.mocked(loadMainConfigModule.loadMainConfig).mockResolvedValue(mainConfig);
  });

  it('adds the addon to main config, writes it and syncs the preview', async () => {
    const { main, done } = setup("export default { addons: ['a'] };", '.storybook/preview.ts');
    await done;

    expect(csfTools.printConfig(main).code).toBe(
      "export default { addons: ['a', '@storybook/addon-docs'] };"
    );
    expect(csfTools.writeConfig).toHaveBeenCalledWith(main);
    expect(loadMainConfigModule.loadMainConfig).toHaveBeenCalledWith({
      configDir: '.storybook',
      skipCache: true,
    });
    expect(syncModule.syncStorybookAddons).toHaveBeenCalledWith(
      mainConfig,
      '.storybook/preview.ts',
      '.storybook'
    );
  });

  it('wraps the addon with the getAbsolutePath wrapper the config declares', async () => {
    const { main, done } = setup(`${WRAPPER}export default { framework: 'react', addons: [] };`);
    await done;

    expect(csfTools.printConfig(main).code).toBe(
      `${WRAPPER}export default { framework: 'react', addons: [getAbsolutePath('@storybook/addon-docs')] };`
    );
  });

  it('creates a missing addons field with the plain name', async () => {
    const { main, done } = setup(`${WRAPPER}export default { framework: 'react' };`);
    await done;

    expect(csfTools.printConfig(main).code).toBe(
      `${WRAPPER}export default { framework: 'react', addons: ['@storybook/addon-docs'] };`
    );
    expect(csfTools.writeConfig).toHaveBeenCalledWith(main);
  });

  it.each([
    [
      'holds a call, not an array',
      "export default { addons: ['a'].filter(Boolean) };",
      "Expected an array literal at 'addons', got 'CallExpression'",
    ],
    ['a later spread could replace', "export default { addons: ['a'], ...base };", 'spread field'],
  ])('throws without writing for an addons field that %s', async (_case, source, message) => {
    const { main, done } = setup(source);

    await expect(done).rejects.toThrow(message);
    expect(csfTools.writeConfig).not.toHaveBeenCalled();
    expect(csfTools.printConfig(main).code).toBe(source);
  });

  it('writes the config even when syncing the preview fails', async () => {
    vi.mocked(syncModule.syncStorybookAddons).mockRejectedValue(new Error('Sync failed'));
    const { main, done } = setup('export default { addons: [] };', '.storybook/preview.ts');

    await expect(done).resolves.toBeUndefined();
    expect(csfTools.writeConfig).toHaveBeenCalledWith(main);
    expect(syncModule.syncStorybookAddons).toHaveBeenCalled();
  });

  it('writes the config without syncing when there is no preview', async () => {
    const { main, done } = setup('export default { addons: [] };');
    await done;

    expect(csfTools.writeConfig).toHaveBeenCalledWith(main);
    expect(syncModule.syncStorybookAddons).not.toHaveBeenCalled();
  });
});
