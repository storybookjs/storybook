import * as fsp from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findConfigFile, formatFileContent } from 'storybook/internal/common';

import { vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { setConfigLayout, transformSetConfigLayout } from './set-config-layout.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const managerConfigPath = '/project/.storybook/manager.ts';

const check = () =>
  setConfigLayout.check({
    packageManager: {} as any,
    configDir: '/project/.storybook',
    mainConfig: {} as any,
    storybookVersion: '11.0.0',
    storiesPaths: [],
    hasCsfFactoryPreview: false,
  });

beforeEach(() => {
  vol.reset();
  vi.mocked(findConfigFile).mockReturnValue(managerConfigPath);
  vi.mocked(formatFileContent).mockImplementation(async (_path, source) => source);
  vi.mocked(fsp.readFile).mockImplementation(vol.promises.readFile as typeof fsp.readFile);
  vi.mocked(fsp.writeFile).mockImplementation(vol.promises.writeFile as typeof fsp.writeFile);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('transformSetConfigLayout', () => {
  it('moves top-level layout and UI options into nested objects', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';

      addons.setConfig({
        showNav: false,
        panelPosition: 'right',
        enableShortcuts: false,
        theme,
      });
    `;

    expect(transformSetConfigLayout(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({
        layout: {
          showNav: false,
          panelPosition: 'right'
        },
        ui: {
          enableShortcuts: false
        },
        theme
      });"
    `);
  });

  it('preserves existing nested options as the higher-precedence values', () => {
    const source = dedent`
      import { addons as managerAddons } from '@storybook/manager-api';

      managerAddons.setConfig({
        showNav: true,
        enableShortcuts: false,
        layout: { showNav: false, showPanel: false },
        ui: { enableShortcuts: true },
      });
    `;

    expect(transformSetConfigLayout(source)).toMatchInlineSnapshot(`
      "import { addons as managerAddons } from '@storybook/manager-api';
      managerAddons.setConfig({
        layout: {
          showNav: false,
          showPanel: false
        },
        ui: {
          enableShortcuts: true
        }
      });"
    `);
  });

  it('does not change unrelated setConfig calls', () => {
    const source = dedent`
      const addons = getAddons();
      addons.setConfig({ showNav: false });
    `;

    expect(transformSetConfigLayout(source)).toBe(source);
  });

  it.each([
    ['a dynamic argument', 'addons.setConfig(config);', 'argument is not an object literal'],
    [
      'a spread property',
      'addons.setConfig({ ...config, showNav: false });',
      'contains a spread or computed property',
    ],
    [
      'a dynamic nested layout',
      'addons.setConfig({ showNav: false, layout: getLayout() });',
      'existing layout value is not an object literal',
    ],
  ])('reports manual guidance for %s', (_label, call, reason) => {
    const source = `import { addons } from 'storybook/manager-api';\n${call}`;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      `${reason}. Move top-level layout options into \`layout\` and \`enableShortcuts\` into \`ui\` manually.`
    );
  });
});

describe('setConfigLayout', () => {
  it('detects and writes a manager config migration', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showToolbar: false });
    `;
    vol.fromJSON({ [managerConfigPath]: source });

    const result = await check();
    expect(result).not.toBeNull();

    await setConfigLayout.run!({ result, dryRun: false } as any);

    await expect(fsp.readFile(managerConfigPath, 'utf8')).resolves.toMatch(
      /layout: \{\s+showToolbar: false/
    );
  });

  it('returns null when the manager config does not need migration', async () => {
    vol.fromJSON({
      [managerConfigPath]: dedent`
        import { addons } from 'storybook/manager-api';
        addons.setConfig({ layout: { showToolbar: false } });
      `,
    });

    await expect(check()).resolves.toBeNull();
  });

  it('returns null when there is no manager config', async () => {
    vi.mocked(findConfigFile).mockReturnValue(null);

    await expect(check()).resolves.toBeNull();
  });
});
