import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatExistingFile, JsPackageManager } from 'storybook/internal/common';

import { fs, vol } from 'memfs';
import { resolve } from 'pathe';
import { dedent } from 'ts-dedent';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { globaltypesDefaultValue } from './globaltypes-default-value.ts';

vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const previewConfigPath = resolve('.storybook/preview.jsx');
const options = {
  packageManager: vi.mocked(JsPackageManager.prototype),
  mainConfig: { stories: [] },
  mainConfigPath: resolve('.storybook/main.js'),
  configDir: resolve('.storybook'),
  storybookVersion: '11.0.0',
  previewConfigPath,
  storiesPaths: [],
};

const migrate = async (source: string, filePath = previewConfigPath) => {
  vol.fromJSON({ [filePath]: source });
  const failures = await runFix(globaltypesDefaultValue, {
    ...options,
    previewConfigPath: filePath,
    result: {},
  });
  return { failures, preview: fs.readFileSync(filePath, 'utf8') };
};

beforeEach(() => {
  vol.reset();
  vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
  vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
  vi.mocked(formatExistingFile).mockImplementation(async (_path, source) => source);
});

afterEach(() => {
  vi.mocked(existsSync).mockRestore();
  vi.mocked(readFile).mockRestore();
  vi.mocked(writeFile).mockRestore();
  vi.mocked(formatExistingFile).mockRestore();
});

describe('globaltypes-default-value', () => {
  it('detects a named default and removes its empty export when applied', async () => {
    const source = "export const globalTypes = { direction: { defaultValue: 'ltr' } };";
    vol.fromJSON({ [previewConfigPath]: source });

    expect(await checkFix(globaltypesDefaultValue, options)).toEqual({});
    expect(fs.readFileSync(previewConfigPath, 'utf8')).toBe(source);
    expect(await runFix(globaltypesDefaultValue, { ...options, result: {} })).toEqual([]);
    expect(fs.readFileSync(previewConfigPath, 'utf8')).toBe(
      "export const initialGlobals = { direction: 'ltr' };"
    );
  });

  it('moves named global defaults and keeps toolbar and JSX configuration', async () => {
    const { failures, preview } = await migrate(dedent`
      export const globalTypes = {
        direction: { defaultValue: 'ltr', toolbar: { items: ['ltr', 'rtl'] } },
        css: { defaultValue: 'basic', toolbar: { items: ['basic', 'wordpress'] } },
      };
      export const decorators = [(Story) => <main><Story /></main>];
    `);

    expect(failures).toEqual([]);
    expect(preview).toMatchInlineSnapshot(`
      "export const globalTypes = {
        direction: { toolbar: { items: ['ltr', 'rtl'] } },
        css: { toolbar: { items: ['basic', 'wordpress'] } },
      };
      export const decorators = [(Story) => <main><Story /></main>];
      export const initialGlobals = { direction: 'ltr', css: 'basic' };"
    `);

    expect(await checkFix(globaltypesDefaultValue, options)).toBeNull();
    expect(await runFix(globaltypesDefaultValue, { ...options, result: {} })).toEqual([]);
    expect(fs.readFileSync(previewConfigPath, 'utf8')).toBe(preview);
  });

  it('migrates defaults without changing neighboring globals that have none', async () => {
    const { failures, preview } = await migrate(dedent`
      export const globalTypes = {
        theme: { description: 'Theme', toolbar: { items: ['light', 'dark'] } },
        direction: { defaultValue: 'ltr', description: 'Direction' },
        locale: { description: 'Locale' },
      };
    `);

    expect(failures).toEqual([]);
    expect(preview).toMatchInlineSnapshot(`
      "export const globalTypes = {
        theme: { description: 'Theme', toolbar: { items: ['light', 'dark'] } },
        direction: { description: 'Direction' },
        locale: { description: 'Locale' },
      };

      export const initialGlobals = { direction: 'ltr' };"
    `);
  });

  it.each(["'rtl'", 'false', 'undefined', 'getDirection()'])(
    'keeps the existing initial value %s',
    async (value) => {
      const { failures, preview } = await migrate(dedent`
        export const globalTypes = { direction: { defaultValue: 'ltr', toolbar: { items: ['ltr', 'rtl'] } } };
        export const initialGlobals = { direction: ${value}, theme: 'dark' };
      `);

      expect(failures).toEqual([]);
      expect(preview).toBe(dedent`
        export const globalTypes = { direction: { toolbar: { items: ['ltr', 'rtl'] } } };
        export const initialGlobals = { direction: ${value}, theme: 'dark' };
      `);
    }
  );

  it.each([
    [
      'a default object',
      dedent`
        export default {
          globalTypes: { direction: { defaultValue: 'ltr', description: 'Direction' } },
        };
      `,
      dedent`
        export default {
          globalTypes: { direction: { description: 'Direction' } },
          initialGlobals: { direction: 'ltr' },
        };
      `,
    ],
    [
      'module.exports',
      dedent`
        module.exports = {
          globalTypes: { direction: { defaultValue: 'ltr', description: 'Direction' } },
        };
      `,
      dedent`
        module.exports = {
          globalTypes: { direction: { description: 'Direction' } },
          initialGlobals: { direction: 'ltr' },
        };
      `,
    ],
    [
      'a local preview object',
      dedent`
        const preview = {
          globalTypes: { direction: { defaultValue: 'ltr', description: 'Direction' } },
        };
        export default preview;
      `,
      dedent`
        const preview = {
          globalTypes: { direction: { description: 'Direction' } },
          initialGlobals: { direction: 'ltr' },
        };
        export default preview;
      `,
    ],
    [
      'a satisfies wrapper',
      dedent`
        import type { Preview } from '@storybook/react-vite';
        const preview = {
          globalTypes: { direction: { defaultValue: 'ltr', description: 'Direction' } },
        } satisfies Preview;
        export default preview;
      `,
      dedent`
        import type { Preview } from '@storybook/react-vite';
        const preview = {
          globalTypes: { direction: { description: 'Direction' } },
          initialGlobals: { direction: 'ltr' },
        } satisfies Preview;
        export default preview;
      `,
    ],
    [
      'definePreview',
      dedent`
        import { definePreview } from '@storybook/react-vite';
        export default definePreview({
          globalTypes: { direction: { defaultValue: 'ltr', description: 'Direction' } },
        });
      `,
      dedent`
        import { definePreview } from '@storybook/react-vite';
        export default definePreview({
          globalTypes: { direction: { description: 'Direction' } },
          initialGlobals: { direction: 'ltr' },
        });
      `,
    ],
    [
      'an as wrapper',
      dedent`
        import type { Preview } from '@storybook/react-vite';
        export default {
          globalTypes: { direction: { defaultValue: 'ltr', description: 'Direction' } },
        } as Preview;
      `,
      dedent`
        import type { Preview } from '@storybook/react-vite';
        export default {
          globalTypes: { direction: { description: 'Direction' } },
          initialGlobals: { direction: 'ltr' },
        } as Preview;
      `,
    ],
  ])('migrates %s without changing its export form', async (_name, source, expected) => {
    const { failures, preview } = await migrate(source, resolve('.storybook/preview.tsx'));

    expect(failures).toEqual([]);
    expect(preview).toBe(expected);
  });

  it.each([
    'false',
    "[false, 0, '', null, { size: -2 }]",
    "{ enabled: true, label: '', sizes: [-1, 2.5] }",
  ])('preserves the literal default %s', async (value) => {
    const { failures, preview } = await migrate(
      `export const globalTypes = { setting: { defaultValue: ${value}, description: 'Setting' } };`
    );

    expect(failures).toEqual([]);
    expect(preview).toBe(dedent`
      export const globalTypes = { setting: { description: 'Setting' } };
      export const initialGlobals = { setting: ${value} };
    `);
  });

  it('keeps a quoted global name', async () => {
    const { failures, preview } = await migrate(
      "export const globalTypes = { 'preferred-locale': { defaultValue: 'en', description: 'Locale' } };"
    );

    expect(failures).toEqual([]);
    expect(preview).toMatchInlineSnapshot(`
      "export const globalTypes = { 'preferred-locale': { description: 'Locale' } };
      export const initialGlobals = { 'preferred-locale': 'en' };"
    `);
  });

  it.each([
    [
      'toolbar metadata without a default',
      "export const globalTypes = { direction: { toolbar: { items: ['ltr', 'rtl'] } } };",
    ],
    [
      'a docs-table default',
      "export const globalTypes = { direction: { table: { defaultValue: { summary: 'ltr' } } } };",
    ],
    [
      'mixed exports without global defaults',
      dedent`
        export default { parameters: { layout: 'fullscreen' } };
        export const globalTypes = { direction: { description: 'Direction' } };
      `,
    ],
    [
      'a spread default overridden by a later global type',
      dedent`
        const types = { direction: { defaultValue: 'ltr' } };
        export const globalTypes = {
          ...types,
          direction: { description: 'Direction' },
        };
      `,
    ],
    [
      'a spread default replaced by a later local spread',
      dedent`
        const defaults = { direction: { defaultValue: 'ltr' } };
        const types = { direction: { description: 'Direction' } };
        export const globalTypes = { ...defaults, ...types };
      `,
    ],
    [
      'a local preview spread without global defaults',
      dedent`
        const shared = { globalTypes: { direction: { description: 'Direction' } } };
        export default { ...shared };
      `,
    ],
    [
      'a local factory config without global defaults',
      dedent`
        import { definePreview } from '@storybook/react-vite';
        const localConfig = { globalTypes: { direction: { description: 'Direction' } } };
        export default definePreview(localConfig);
      `,
    ],
    [
      'an imported factory config',
      dedent`
        import { definePreview } from '@storybook/react-vite';
        import config from './config';
        export default definePreview(config);
      `,
    ],
    [
      'a dynamic global name without a default',
      "export const globalTypes = { [getName()]: { toolbar: { items: ['ltr', 'rtl'] } } };",
    ],
    [
      'boolean and null metadata keys',
      "export const globalTypes = { direction: { [true]: 'a', [null]: 'b', toolbar: {} } };",
    ],
  ])('does not apply to %s', async (_name, source) => {
    vol.fromJSON({ [previewConfigPath]: source });

    expect(await checkFix(globaltypesDefaultValue, options)).toBeNull();
    expect(await runFix(globaltypesDefaultValue, { ...options, result: {} })).toEqual([]);
    expect(fs.readFileSync(previewConfigPath, 'utf8')).toBe(source);
  });

  it('does not apply when there is no preview file', async () => {
    expect(
      await checkFix(globaltypesDefaultValue, { ...options, previewConfigPath: undefined })
    ).toBeNull();
    expect(vol.toJSON()).toEqual({});
  });

  it('does not change matching properties in main, manager or story files', async () => {
    const managerPath = resolve('.storybook/manager.js');
    const storyPath = resolve('src/Direction.stories.js');
    const source = "export default { globalTypes: { direction: { defaultValue: 'ltr' } } };";
    const files = {
      [options.mainConfigPath]: source,
      [managerPath]: source,
      [storyPath]: source,
      [previewConfigPath]: 'export default {};',
    };
    vol.fromJSON(files);
    vi.mocked(existsSync).mockImplementation(fs.existsSync);
    const project = { ...options, storiesPaths: [storyPath] };

    expect(await checkFix(globaltypesDefaultValue, project)).toBeNull();
    expect(await runFix(globaltypesDefaultValue, { ...project, result: {} })).toEqual([]);
    expect(vol.toJSON()).toEqual(files);
  });

  it('preserves comments and CRLF line endings', async () => {
    const { failures, preview } = await migrate(
      [
        '// The toolbar controls the writing direction.',
        'export const globalTypes = {',
        '  direction: {',
        "    defaultValue: 'ltr',",
        "    description: 'Direction', // Used in the toolbar.",
        '  },',
        '};',
      ].join('\r\n')
    );

    expect(failures).toEqual([]);
    expect(preview).toBe(
      [
        '// The toolbar controls the writing direction.',
        'export const globalTypes = {',
        '  direction: {',
        "    description: 'Direction', // Used in the toolbar.",
        '  },',
        '};',
        '',
        "export const initialGlobals = { direction: 'ltr' };",
      ].join('\r\n')
    );
  });

  it.each([
    [
      'a source spread',
      "export const globalTypes = { ...shared, direction: { defaultValue: 'ltr' } };",
      'Cannot migrate globalTypes with spreads or dynamic keys. Set initialGlobals manually.',
    ],
    [
      'a destination spread',
      "export const globalTypes = { direction: { defaultValue: 'ltr' } }; export const initialGlobals = { ...shared };",
      'line 1: Cannot mutate initialGlobals.direction because the target contains spread field. Set initialGlobals manually.',
    ],
    [
      'an unsafe default after a safe one',
      dedent`
        export const globalTypes = {
          direction: { defaultValue: 'ltr' },
          theme: { defaultValue: getTheme() },
        };
      `,
      'Cannot migrate globalTypes.theme.defaultValue automatically. Set initialGlobals manually.',
    ],
    [
      'an effectful default with an existing initial value',
      "export const globalTypes = { direction: { defaultValue: getDirection() } };\nexport const initialGlobals = { direction: 'rtl' };",
      'Cannot migrate globalTypes.direction.defaultValue automatically. Set initialGlobals manually.',
    ],
    [
      'a dynamic global name',
      "export const globalTypes = { [getName()]: { defaultValue: 'ltr' } };",
      'Cannot migrate globalTypes with spreads or dynamic keys. Set initialGlobals manually.',
    ],
    [
      'duplicate global names',
      "export const globalTypes = { direction: { defaultValue: 'ltr' }, direction: { defaultValue: 'rtl' } };",
      'line 1: Cannot mutate globalTypes.direction.defaultValue because the target contains duplicate field. Set initialGlobals manually.',
    ],
    [
      'an object default with a literal and a call',
      "export const globalTypes = { theme: { defaultValue: { color: 'red', size: getSize() } } };",
      'Cannot migrate globalTypes.theme.defaultValue automatically. Set initialGlobals manually.',
    ],
    [
      'a negated call',
      'export const globalTypes = { offset: { defaultValue: -getOffset() } };',
      'Cannot migrate globalTypes.offset.defaultValue automatically. Set initialGlobals manually.',
    ],
    [
      'an array containing a function call',
      'export const globalTypes = { theme: { defaultValue: [1, getColor()] } };',
      'Cannot migrate globalTypes.theme.defaultValue automatically. Set initialGlobals manually.',
    ],
    [
      'a computed property in the default value',
      "export const globalTypes = { theme: { defaultValue: { ['a']: 1 } } };",
      'Cannot migrate globalTypes.theme.defaultValue automatically. Set initialGlobals manually.',
    ],
    [
      'a bigint inside a default object',
      'export const globalTypes = { theme: { defaultValue: { m: 1n } } };',
      'Cannot migrate globalTypes.theme.defaultValue automatically. Set initialGlobals manually.',
    ],
    [
      'a spread in the default value',
      'export const globalTypes = { theme: { defaultValue: { ...shared } } };',
      'Cannot migrate globalTypes.theme.defaultValue automatically. Set initialGlobals manually.',
    ],
    [
      'an imported property name',
      dedent`
        import { defaultKey } from './keys';
        export const globalTypes = { direction: { [defaultKey]: 'ltr' } };
      `,
      'line 2: Cannot mutate globalTypes.direction.defaultValue because the target contains dynamic key. Set initialGlobals manually.',
    ],
    [
      'named global types after a default export',
      dedent`
        export default { parameters: { layout: 'fullscreen' } };
        export const globalTypes = { direction: { defaultValue: 'ltr' } };
      `,
      'line 1: Cannot mutate mixed default and named config exports. Set initialGlobals manually.',
    ],
    [
      'a default supplied by a local preview spread',
      dedent`
        const shared = { globalTypes: { direction: { defaultValue: 'ltr' } } };
        export default { ...shared };
      `,
      'line 2: Cannot mutate globalTypes.direction.defaultValue because the target contains spread field. Set initialGlobals manually.',
    ],
    [
      'a default in a local factory config',
      dedent`
        import { definePreview } from '@storybook/react-vite';
        const localConfig = { globalTypes: { direction: { defaultValue: 'ltr' } } };
        export default definePreview(localConfig);
      `,
      'Cannot mutate a config without a static object initializer. Set initialGlobals manually.',
    ],
    [
      'a dynamic global name beside a default',
      "export const globalTypes = { [getName()]: { toolbar: {} }, direction: { defaultValue: 'ltr' } };",
      'Cannot migrate globalTypes with spreads or dynamic keys. Set initialGlobals manually.',
    ],
    [
      'named global types beside an imported preview spread',
      dedent`
        import shared from './shared';
        export default { ...shared };
        export const globalTypes = { direction: { defaultValue: 'ltr' } };
      `,
      'line 2: Cannot mutate globalTypes.direction.defaultValue because the target contains spread field. Set initialGlobals manually.',
    ],
    [
      'a config from a namespace factory',
      dedent`
        import * as sb from '@storybook/react-vite';
        export default sb.definePreview({ globalTypes: { direction: { defaultValue: 'ltr' } } });
      `,
      'line 2: Cannot mutate an arbitrary config factory call. Set initialGlobals manually.',
    ],
    [
      'a reassigned config binding',
      dedent`
        let preview = { globalTypes: { direction: { defaultValue: 'ltr' } } };
        if (process.env.CI) {
          preview = { ...preview, parameters: {} };
        }
        export default preview;
      `,
      'line 1: Cannot mutate a shared or reassigned config binding. Set initialGlobals manually.',
    ],
    [
      'a conditional module.exports',
      dedent`
        if (typeof window !== 'undefined') {
          module.exports = { globalTypes: { direction: { defaultValue: 'ltr' } } };
        }
      `,
      'line 2: Cannot mutate a config declared inside a function or conditional. Set initialGlobals manually.',
    ],
    [
      'a default held by a member of a local object',
      dedent`
        const toolbars = { direction: { defaultValue: 'ltr' } };
        export const globalTypes = { direction: toolbars.direction };
      `,
      'line 2: Cannot mutate globalTypes.direction.defaultValue because the target contains unsupported member. Set initialGlobals manually.',
    ],
    [
      'an exported global types object passed to a call',
      dedent`
        export const globalTypes = { direction: { defaultValue: 'ltr' } };
        register(globalTypes);
      `,
      'line 1: Cannot mutate the shared or reassigned globalTypes export. Set initialGlobals manually.',
    ],
    [
      'a global type with an imported spread beside a default',
      dedent`
        import { localeGlobal } from '@acme/storybook-shared';
        export const globalTypes = {
          locale: { ...localeGlobal, toolbar: { icon: 'globe' } },
          theme: { defaultValue: 'light' },
        };
      `,
      'line 3: Cannot mutate globalTypes.locale.defaultValue because the target contains spread field. Set initialGlobals manually.',
    ],
    [
      'a factory config exported as default by name',
      dedent`
        import { definePreview } from '@storybook/react-vite';
        const config = { globalTypes: { direction: { defaultValue: 'ltr' } } };
        const preview = definePreview(config);
        export { preview as default };
      `,
      'Cannot migrate globalTypes.direction.defaultValue automatically. Set initialGlobals manually.',
    ],
    [
      'a reassigned global types binding in a config held by an alias',
      dedent`
        let types = { direction: { defaultValue: 'ltr' } };
        if (process.env.CI) {
          types = {};
        }
        const config = { globalTypes: types };
        const preview = config;
        export default preview;
      `,
      'Cannot mutate a config without a static object initializer. Set initialGlobals manually.',
    ],
    [
      'a custom factory config held by a constant',
      dedent`
        import { createPreview } from '@acme/storybook-config';
        const config = { globalTypes: { direction: { defaultValue: 'ltr' } } };
        export default createPreview(config);
      `,
      'Cannot mutate a config without a static object initializer. Set initialGlobals manually.',
    ],
    [
      'a member expression',
      'export const globalTypes = { direction: { defaultValue: defaults.direction } };',
      'Cannot migrate globalTypes.direction.defaultValue automatically. Set initialGlobals manually.',
    ],
    [
      'named global types before a default export that sets them to undefined',
      dedent`
        export const globalTypes = { direction: { defaultValue: 'ltr' } };
        export default { globalTypes: undefined };
      `,
      'line 2: Cannot mutate globalTypes.direction.defaultValue because the target contains unsupported member. Set initialGlobals manually.',
    ],
    [
      'named global types after a default export that sets them to undefined',
      dedent`
        export default { globalTypes: undefined };
        export const globalTypes = { direction: { defaultValue: 'ltr' } };
      `,
      'line 1: Cannot mutate globalTypes.direction.defaultValue because the target contains unsupported member. Set initialGlobals manually.',
    ],
  ])('requires a manual migration for %s', async (_name, source, reason) => {
    vol.fromJSON({ [previewConfigPath]: source });
    expect(await checkFix(globaltypesDefaultValue, options)).toEqual({});

    const { failures, preview } = await migrate(source);

    expect(failures).toEqual([
      {
        file: previewConfigPath,
        kind: 'preview',
        message: reason,
      },
    ]);
    expect(preview).toBe(source);
  });

  it('migrates global types through multiple local aliases', async () => {
    const source = dedent`
      const defaults = {
        direction: { defaultValue: 'ltr', description: 'Direction' },
      };
      const types = defaults;
      export const globalTypes = types;
    `;
    vol.fromJSON({ [previewConfigPath]: source });

    expect(await checkFix(globaltypesDefaultValue, options)).toEqual({});

    const { failures, preview } = await migrate(source);

    expect(failures).toEqual([]);
    expect(preview).toBe(dedent`
      const defaults = {
        direction: { description: 'Direction' },
      };
      const types = defaults;
      export const globalTypes = types;
      export const initialGlobals = { direction: 'ltr' };
    `);
  });

  it('migrates a factory argument wrapped in as const', async () => {
    const source = dedent`
        import { definePreview, type Preview } from '@storybook/react-vite';
        export default definePreview({
          globalTypes: { direction: { defaultValue: 'ltr' } },
        } as const);
      `;
    vol.fromJSON({ [previewConfigPath]: source });

    expect(await checkFix(globaltypesDefaultValue, options)).toEqual({});

    const { failures, preview } = await migrate(source);

    expect(failures).toEqual([]);
    expect(preview).toBe(dedent`
        import { definePreview, type Preview } from '@storybook/react-vite';
        export default definePreview({
          initialGlobals: { direction: 'ltr' },
        } as const);
      `);
  });
});
