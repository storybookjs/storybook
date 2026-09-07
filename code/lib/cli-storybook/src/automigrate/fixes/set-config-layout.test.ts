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

      addons.setConfig({ showNav: false, panelPosition: 'right', enableShortcuts: false, theme });
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

  it('replaces nested options with their top-level values', () => {
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
        layout: { showPanel: false, showNav: true },
        ui: { enableShortcuts: false }
      });"
    `);
  });

  it('does not change a spread config without an explicit deprecated option', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ ...config, theme });
    `;

    expect(transformSetConfigLayout(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({ ...config, theme });"
    `);
  });

  it('preserves a TypeScript satisfies wrapper around the config argument', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false } satisfies Addon_Config);
    `;

    expect(transformSetConfigLayout(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({ layout: {
        showNav: false
      } } satisfies Addon_Config);"
    `);
  });

  it('preserves a TypeScript as wrapper around the config argument', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false } as Addon_Config);
    `;

    expect(transformSetConfigLayout(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({ layout: {
        showNav: false
      } } as Addon_Config);"
    `);
  });

  it('preserves a TypeScript non-null wrapper around the config argument', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false }!);
    `;

    expect(transformSetConfigLayout(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({ layout: {
        showNav: false
      } }!);"
    `);
  });

  it('moves a statically wrapped option into a statically wrapped layout object', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({
        showNav: false as const,
        layout: {} satisfies Partial<Addon_Config['layout']>,
      });
    `;

    expect(transformSetConfigLayout(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({
        layout: {
          showNav: false as const
        } satisfies Partial<Addon_Config['layout']>
      });"
    `);
  });

  it('replaces nested recent visible sizes with the top-level value', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({
        recentVisibleSizes: { navSize: 200, bottomPanelHeight: 300 },
        layout: { recentVisibleSizes: { navSize: 100 } },
      });
    `;

    expect(transformSetConfigLayout(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({
        layout: { recentVisibleSizes: { navSize: 200, bottomPanelHeight: 300 } }
      });"
    `);
  });

  it('moves an option into a nested object with a spread', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: true, layout: { ...layout, showPanel: false } });
    `;

    expect(transformSetConfigLayout(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({
        layout: {
          ...layout,
          showPanel: false,
          showNav: true
        }
      });"
    `);
  });

  it('migrates a destructured CommonJS import', () => {
    const source = dedent`
      const { addons } = require('storybook/manager-api');
      addons.setConfig({ showNav: false });
    `;

    expect(transformSetConfigLayout(source)).toMatchInlineSnapshot(`
      "const { addons } = require('storybook/manager-api');
      addons.setConfig({ layout: {
        showNav: false
      } });"
    `);
  });

  it('migrates multiple setConfig calls independently', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ layout: { showNav: false } });
      addons.setConfig({ showPanel: false });
    `;

    expect(transformSetConfigLayout(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({ layout: { showNav: false } });
      addons.setConfig({ layout: {
        showPanel: false
      } });"
    `);
  });

  it('moves separated dynamic values into layout', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({
        showNav: record('showNav'),
        theme: record('theme'),
        panelPosition: record('panelPosition'),
      });
    `;

    expect(transformSetConfigLayout(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({
        layout: {
          showNav: record('showNav'),
          panelPosition: record('panelPosition')
        },

        theme: record('theme')
      });"
    `);
  });

  it('moves a dynamic value into an existing group', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: readPreference(), theme, layout: {} });
    `;

    expect(transformSetConfigLayout(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({
        theme,

        layout: {
          showNav: readPreference()
        }
      });"
    `);
  });

  it('does not change unrelated setConfig calls', () => {
    const source = dedent`
      const addons = getAddons();
      addons.setConfig({ showNav: false });
    `;

    expect(transformSetConfigLayout(source)).toMatchInlineSnapshot(`
      "const addons = getAddons();
      addons.setConfig({ showNav: false });"
    `);
  });

  it('reports manual guidance for a dynamic argument', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig(config);
    `;

    expect(() =>
      transformSetConfigLayout(source, managerConfigPath)
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Cannot automigrate addons.setConfig in /project/.storybook/manager.ts on line 2: the configuration argument is not an object literal. Move top-level layout options into \`layout\` and \`enableShortcuts\` into \`ui\` manually.]`
    );
  });

  it('reports manual guidance for a spread property', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ ...config, showNav: false });
    `;

    expect(() =>
      transformSetConfigLayout(source, managerConfigPath)
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Cannot automigrate addons.setConfig in /project/.storybook/manager.ts on line 2: the configuration contains a spread or computed property. Move top-level layout options into \`layout\` and \`enableShortcuts\` into \`ui\` manually.]`
    );
  });

  it('reports manual guidance for a computed legacy property', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ ['showNav']: false });
    `;

    expect(() =>
      transformSetConfigLayout(source, managerConfigPath)
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Cannot automigrate addons.setConfig in /project/.storybook/manager.ts on line 2: the configuration contains a spread or computed property. Move top-level layout options into \`layout\` and \`enableShortcuts\` into \`ui\` manually.]`
    );
  });

  it('reports manual guidance for a dynamic nested layout', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false, layout: getLayout() });
    `;

    expect(() =>
      transformSetConfigLayout(source, managerConfigPath)
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Cannot automigrate addons.setConfig in /project/.storybook/manager.ts on line 2: the existing layout value is not an object literal. Move top-level layout options into \`layout\` and \`enableShortcuts\` into \`ui\` manually.]`
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

    await expect(fsp.readFile(managerConfigPath, 'utf8')).resolves.toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({ layout: {
        showToolbar: false
      } });"
    `);
  });

  it('does not write the manager config during a dry run', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showToolbar: false });
    `;
    vol.fromJSON({ [managerConfigPath]: source });

    const result = await check();
    expect(result).not.toBeNull();

    await setConfigLayout.run!({ result, dryRun: true } as any);

    await expect(fsp.readFile(managerConfigPath, 'utf8')).resolves.toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({ showToolbar: false });"
    `);
  });

  it('returns null when the manager config does not need migration', async () => {
    vol.fromJSON({
      [managerConfigPath]: dedent`
        import { addons } from 'storybook/manager-api';
        addons.setConfig({ layout: { showToolbar: false } });
      `,
    });

    await expect(check()).resolves.toMatchInlineSnapshot(`null`);
  });

  it('returns null when there is no manager config', async () => {
    vi.mocked(findConfigFile).mockReturnValue(null);

    await expect(check()).resolves.toMatchInlineSnapshot(`null`);
  });
});
