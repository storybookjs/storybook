import { writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from 'storybook/internal/csf-tools';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { fs, vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { formatFileContent } from './formatter.ts';
import { loadMainConfig } from './load-main-config.ts';
import { setupAddonInConfig } from './setup-addon-in-config.ts';
import { syncStorybookAddons } from './sync-main-preview-addons.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('./formatter.ts', { spy: true });
vi.mock('./load-main-config.ts', { spy: true });
vi.mock('./sync-main-preview-addons.ts', { spy: true });

const mainConfigPath = '/project/.storybook/main.ts';
const mainConfig = { addons: [] } as unknown as StorybookConfigRaw;

const setup = (source: string, previewConfigPath?: string) =>
  setupAddonInConfig({
    addonName: '@storybook/addon-docs',
    mainConfigCSFFile: loadConfig(source, mainConfigPath).parse(),
    previewConfigPath,
    configDir: '/project/.storybook',
  });

describe('setupAddonInConfig', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vi.mocked(formatFileContent).mockImplementation(async (_path, code) => `${code}\n// formatted`);
    vi.mocked(loadMainConfig).mockResolvedValue(mainConfig);
    vi.mocked(syncStorybookAddons).mockResolvedValue();
    vol.fromJSON({ [mainConfigPath]: '' });
  });

  it('adds the addon and writes the main config through the project formatter', async () => {
    await setup(
      "export default { addons: ['@storybook/addon-a11y'] };",
      '/project/.storybook/preview.ts'
    );

    expect(fs.readFileSync(mainConfigPath, 'utf8')).toBe(
      "export default { addons: ['@storybook/addon-a11y', '@storybook/addon-docs'] };\n// formatted"
    );
    expect(syncStorybookAddons).toHaveBeenCalledWith(
      mainConfig,
      '/project/.storybook/preview.ts',
      '/project/.storybook'
    );
  });

  it('wraps the addon with getAbsolutePath when the main config uses it', async () => {
    await setup(dedent`
      import { dirname } from 'node:path';

      function getAbsolutePath(value: string) {
        return dirname(require.resolve(value));
      }

      export default { addons: [getAbsolutePath('@storybook/addon-a11y')] };
    `);

    expect(fs.readFileSync(mainConfigPath, 'utf8')).toContain(
      "getAbsolutePath('@storybook/addon-docs')"
    );
  });

  it('adds an addons field when there is none', async () => {
    await setup('export default { stories: [] };');

    expect(fs.readFileSync(mainConfigPath, 'utf8')).toContain('addons: ["@storybook/addon-docs"]');
  });

  it('keeps the written main config when syncing the preview fails', async () => {
    vi.mocked(syncStorybookAddons).mockRejectedValue(new Error('Sync failed'));

    await expect(
      setup('export default { addons: [] };', '/project/.storybook/preview.ts')
    ).resolves.toBeUndefined();

    expect(fs.readFileSync(mainConfigPath, 'utf8')).toContain('@storybook/addon-docs');
  });
});
