import * as fsp from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findConfigFile, formatFileContent } from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { setConfigLayout, transformSetConfigLayout } from './set-config-layout.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const managerConfigPath = '/project/.storybook/manager.ts';
const configDir = '/project/.storybook';
const packageManager = {} as JsPackageManager;
const mainConfig = {} as StorybookConfigRaw;

const check = () =>
  setConfigLayout.check({
    packageManager,
    configDir,
    mainConfig,
    storybookVersion: '11.0.0',
    storiesPaths: [],
    hasCsfFactoryPreview: false,
  });

const run = (result: NonNullable<Awaited<ReturnType<typeof check>>>, dryRun: boolean) =>
  setConfigLayout.run!({
    packageManager,
    result,
    dryRun,
    mainConfigPath: '/project/.storybook/main.ts',
    mainConfig,
    configDir,
    storybookVersion: '11.0.0',
    storiesPaths: [],
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

  it('reports conflicts because nested layout and UI options are authoritative', () => {
    const source = dedent`
      import { addons as managerAddons } from '@storybook/manager-api';

      managerAddons.setConfig({
        showNav: true,
        enableShortcuts: false,
        layout: { showNav: false, showPanel: false },
        ui: { enableShortcuts: true },
      });
    `;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'the showNav option exists at both top level and inside layout, where the nested value is authoritative'
    );
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

  it('reports a recentVisibleSizes conflict instead of deep-merging it', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({
        recentVisibleSizes: { navSize: 200, bottomPanelHeight: 300 },
        layout: { recentVisibleSizes: { navSize: 100 } },
      });
    `;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'the recentVisibleSizes option exists at both top level and inside layout, where the nested value is authoritative'
    );
  });

  it('reports a spread in an existing nested object', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: true, layout: { ...layout, showPanel: false } });
    `;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'the existing layout object contains a spread property'
    );
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

  it('reports the location of an unsafe call after an independently safe call', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showPanel: false });
      addons.setConfig({ showNav: false, layout: { showNav: true } });
    `;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'on line 3: the showNav option exists at both top level and inside layout'
    );
  });

  it('is idempotent', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false, showPanel: true, theme });
    `;
    const transformed = transformSetConfigLayout(source);

    expect(transformSetConfigLayout(transformed)).toBe(transformed);
  });

  it('reports non-contiguous properties whose grouping could change evaluation order', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({
        showNav: record('showNav'),
        theme: record('theme'),
        panelPosition: record('panelPosition'),
      });
    `;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'the top-level layout options are not contiguous, so grouping them could change expression evaluation order'
    );
  });

  it('reports a side-effectful relocation into an existing group', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: readPreference(), theme, layout: {} });
    `;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'the showNav option has a CallExpression value whose relocation into the existing layout object could change expression evaluation order'
    );
  });

  it.each([
    ['an identifier read', 'preference'],
    ['a member read', 'settings.showNav'],
    ['construction', 'new Boolean(false)'],
    ['assignment', '(preference = false)'],
    ['an update', 'counter++'],
  ])('reports %s relocated into an existing group', (_label, value) => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: ${value}, layout: {} });
    `;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'could change expression evaluation order'
    );
  });

  it('reports a duplicate destination group', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false, layout: {}, layout: {} });
    `;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'the configuration defines layout more than once'
    );
  });

  it('reports a UI conflict independently of layout', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ enableShortcuts: false, ui: { enableShortcuts: true } });
    `;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'the enableShortcuts option exists at both top level and inside ui'
    );
  });

  it.each([
    ['a computed string key', "['showPanel']: false"],
    ['a computed template key', '[`showPanel`]: false'],
  ])('reports %s in an existing nested object', (_label, property) => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false, layout: { ${property} } });
    `;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'the existing layout object contains a computed property'
    );
  });

  it.each([
    ['a method', 'showPanel() {}'],
    ['an accessor', 'get showPanel() { return false; }'],
  ])('reports %s in an existing nested object', (_label, property) => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false, layout: { ${property} } });
    `;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'the existing layout object contains a method or accessor'
    );
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

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'on line 2: the configuration argument is not an object literal. Move top-level layout options into `layout` and `enableShortcuts` into `ui` manually. Keep nested values when an option exists in both places and retain expression evaluation order.'
    );
  });

  it('reports manual guidance for a spread property', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ ...config, showNav: false });
    `;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'on line 2: the configuration contains a spread property'
    );
  });

  it('reports manual guidance for a computed legacy property', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ ['showNav']: false });
    `;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'on line 2: the configuration contains a computed property'
    );
  });

  it('reports manual guidance for a computed-template legacy property', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ [\`showNav\`]: false });
    `;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'on line 2: the configuration contains a computed property'
    );
  });

  it('reports a top-level deprecated method that cannot be moved as a value', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav() {} });
    `;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'the top-level showNav layout option is a method or accessor, not a movable value property'
    );
  });

  it('reports manual guidance for a dynamic nested layout', () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false, layout: getLayout() });
    `;

    expect(() => transformSetConfigLayout(source, managerConfigPath)).toThrow(
      'on line 2: the existing layout value is not an object literal'
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
    if (!result) {
      throw new Error('expected a migration result');
    }

    await run(result, false);

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
    if (!result) {
      throw new Error('expected a migration result');
    }

    await run(result, true);

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
