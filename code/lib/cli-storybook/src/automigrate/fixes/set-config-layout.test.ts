import * as fsp from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findConfigFile, formatFileContent } from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { setConfigLayout } from './set-config-layout.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const managerConfigPath = '/project/.storybook/manager.ts';
const configDir = '/project/.storybook';
const packageManager = {} as JsPackageManager;
const mainConfig = {} as StorybookConfigRaw;

const check = () =>
  checkFix(setConfigLayout, {
    packageManager,
    configDir,
    mainConfigPath: '/project/.storybook/main.ts',
    mainConfig,
    storybookVersion: '11.0.0',
    storiesPaths: [],
  });

const run = (result: NonNullable<Awaited<ReturnType<typeof check>>>) =>
  runFix(setConfigLayout, {
    packageManager,
    result,
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

const migrate = async (source: string) => {
  vol.fromJSON({ [managerConfigPath]: source });
  const failures = await run({});
  if (failures.length > 0) {
    throw new Error(failures.map(({ message }) => message).join('\n'));
  }
  return vol.readFileSync(managerConfigPath, 'utf8') as string;
};

describe('set-config-layout transform', () => {
  it('moves top-level layout and UI options into nested objects', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';

      addons.setConfig({ showNav: false, panelPosition: 'right', enableShortcuts: false, theme });
    `;

    expect(await migrate(source)).toMatchInlineSnapshot(`
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

  it('reports conflicts because nested layout and UI options are authoritative', async () => {
    const source = dedent`
      import { addons as managerAddons } from '@storybook/manager-api';

      managerAddons.setConfig({
        showNav: true,
        enableShortcuts: false,
        layout: { showNav: false, showPanel: false },
        ui: { enableShortcuts: true },
      });
    `;

    await expect(migrate(source)).rejects.toThrow(
      'the showNav option exists at both top level and inside layout, where the nested value is authoritative'
    );
  });

  it('does not change a spread config without an explicit deprecated option', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ ...config, theme });
    `;

    expect(await migrate(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({ ...config, theme });"
    `);
  });

  it('preserves a TypeScript satisfies wrapper around the config argument', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false } satisfies Addon_Config);
    `;

    expect(await migrate(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({ layout: {
        showNav: false
      } } satisfies Addon_Config);"
    `);
  });

  it('preserves a TypeScript as wrapper around the config argument', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false } as Addon_Config);
    `;

    expect(await migrate(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({ layout: {
        showNav: false
      } } as Addon_Config);"
    `);
  });

  it('preserves a TypeScript non-null wrapper around the config argument', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false }!);
    `;

    expect(await migrate(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({ layout: {
        showNav: false
      } }!);"
    `);
  });

  it('moves a statically wrapped option into a statically wrapped layout object', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({
        showNav: false as const,
        layout: {} satisfies Partial<Addon_Config['layout']>,
      });
    `;

    expect(await migrate(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({
        layout: {
          showNav: false as const
        } satisfies Partial<Addon_Config['layout']>
      });"
    `);
  });

  it('reports a recentVisibleSizes conflict instead of deep-merging it', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({
        recentVisibleSizes: { navSize: 200, bottomPanelHeight: 300 },
        layout: { recentVisibleSizes: { navSize: 100 } },
      });
    `;

    await expect(migrate(source)).rejects.toThrow(
      'the recentVisibleSizes option exists at both top level and inside layout, where the nested value is authoritative'
    );
  });

  it('reports a spread in an existing nested object', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: true, layout: { ...layout, showPanel: false } });
    `;

    await expect(migrate(source)).rejects.toThrow(
      'the existing layout object contains a spread property'
    );
  });

  it('migrates a destructured CommonJS import', async () => {
    const source = dedent`
      const { addons } = require('storybook/manager-api');
      addons.setConfig({ showNav: false });
    `;

    expect(await migrate(source)).toMatchInlineSnapshot(`
      "const { addons } = require('storybook/manager-api');
      addons.setConfig({ layout: {
        showNav: false
      } });"
    `);
  });

  it('migrates multiple setConfig calls independently', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ layout: { showNav: false } });
      addons.setConfig({ showPanel: false });
    `;

    expect(await migrate(source)).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({ layout: { showNav: false } });
      addons.setConfig({ layout: {
        showPanel: false
      } });"
    `);
  });

  it('reports the location of an unsafe call after an independently safe call', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showPanel: false });
      addons.setConfig({ showNav: false, layout: { showNav: true } });
    `;

    await expect(migrate(source)).rejects.toThrow(
      'line 3: the showNav option exists at both top level and inside layout'
    );
  });

  it('is idempotent', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false, showPanel: true, theme });
    `;
    const transformed = await migrate(source);

    expect(await migrate(transformed)).toBe(transformed);
  });

  it('reports non-contiguous properties whose grouping could change evaluation order', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({
        showNav: record('showNav'),
        theme: record('theme'),
        panelPosition: record('panelPosition'),
      });
    `;

    await expect(migrate(source)).rejects.toThrow(
      'the top-level layout options are not contiguous, so grouping them could change expression evaluation order'
    );
  });

  it('reports a side-effectful relocation into an existing group', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: readPreference(), theme, layout: {} });
    `;

    await expect(migrate(source)).rejects.toThrow(
      'the showNav option has a CallExpression value whose relocation into the existing layout object could change expression evaluation order'
    );
  });

  it.each([
    ['an identifier read', 'preference'],
    ['a member read', 'settings.showNav'],
    ['construction', 'new Boolean(false)'],
    ['assignment', '(preference = false)'],
    ['an update', 'counter++'],
  ])('reports %s relocated into an existing group', async (_label, value) => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: ${value}, layout: {} });
    `;

    await expect(migrate(source)).rejects.toThrow('could change expression evaluation order');
  });

  it('reports a duplicate destination group', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false, layout: {}, layout: {} });
    `;

    await expect(migrate(source)).rejects.toThrow(
      'the configuration defines layout more than once'
    );
  });

  it('reports a UI conflict independently of layout', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ enableShortcuts: false, ui: { enableShortcuts: true } });
    `;

    await expect(migrate(source)).rejects.toThrow(
      'the enableShortcuts option exists at both top level and inside ui'
    );
  });

  it.each([
    ['a computed string key', "['showPanel']: false"],
    ['a computed template key', '[`showPanel`]: false'],
  ])('reports %s in an existing nested object', async (_label, property) => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false, layout: { ${property} } });
    `;

    await expect(migrate(source)).rejects.toThrow(
      'the existing layout object contains a computed property'
    );
  });

  it.each([
    ['a method', 'showPanel() {}'],
    ['an accessor', 'get showPanel() { return false; }'],
  ])('reports %s in an existing nested object', async (_label, property) => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false, layout: { ${property} } });
    `;

    await expect(migrate(source)).rejects.toThrow(
      'the existing layout object contains a method or accessor'
    );
  });

  it('does not change unrelated setConfig calls', async () => {
    const source = dedent`
      const addons = getAddons();
      addons.setConfig({ showNav: false });
    `;

    expect(await migrate(source)).toMatchInlineSnapshot(`
      "const addons = getAddons();
      addons.setConfig({ showNav: false });"
    `);
  });

  it('reports the line of a dynamic argument', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig(config);
    `;

    await expect(migrate(source)).rejects.toThrow(
      'line 2: the call argument is not an object literal'
    );
  });

  it('reports the line of a spread property', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ ...config, showNav: false });
    `;

    await expect(migrate(source)).rejects.toThrow(
      'line 2: the configuration contains a spread property'
    );
  });

  it('reports the line of a computed legacy property', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ ['showNav']: false });
    `;

    await expect(migrate(source)).rejects.toThrow(
      'line 2: the configuration contains a computed property'
    );
  });

  it('reports the line of a computed-template legacy property', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ [\`showNav\`]: false });
    `;

    await expect(migrate(source)).rejects.toThrow(
      'line 2: the configuration contains a computed property'
    );
  });

  it('reports a top-level deprecated method that cannot be moved as a value', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav() {} });
    `;

    await expect(migrate(source)).rejects.toThrow(
      'the top-level showNav layout option is a method or accessor, not a movable value property'
    );
  });

  it('reports the line of a dynamic nested layout', async () => {
    const source = dedent`
      import { addons } from 'storybook/manager-api';
      addons.setConfig({ showNav: false, layout: getLayout() });
    `;

    await expect(migrate(source)).rejects.toThrow(
      'line 2: the existing layout value is not an object literal'
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

    await run(result);

    await expect(fsp.readFile(managerConfigPath, 'utf8')).resolves.toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      addons.setConfig({ layout: {
        showToolbar: false
      } });"
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
