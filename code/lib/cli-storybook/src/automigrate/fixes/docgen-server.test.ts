import * as fsp from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatExistingFile } from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { vol } from 'memfs';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { docgenServer } from './docgen-server.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const configDir = '/project/.storybook';
const mainConfigPath = '/project/.storybook/main.ts';
const packageManager = {} as JsPackageManager;
const react: StorybookConfigRaw = { framework: '@storybook/react-vite', stories: [] };
const vue: StorybookConfigRaw = { framework: '@storybook/vue3-vite', stories: [] };
const angular: StorybookConfigRaw = { framework: '@storybook/angular-vite', stories: [] };
const svelte: StorybookConfigRaw = { framework: '@storybook/svelte-vite', stories: [] };
const deprecatedFalse = 'export default { features: { experimentalDocgenServer: false } };';

const check = (
  mainConfig: StorybookConfigRaw,
  versions: { beforeVersion?: string; storybookVersion?: string; requested?: boolean } = {}
) =>
  checkFix(docgenServer, {
    packageManager,
    configDir,
    mainConfigPath,
    mainConfig,
    beforeVersion: '10.6.0',
    storybookVersion: '11.0.0',
    storiesPaths: [],
    ...versions,
  });

const migrate = async (source: string, mainConfig: StorybookConfigRaw = react) => {
  vol.fromJSON({ [mainConfigPath]: source });
  const result = await check(mainConfig);
  if (!result) {
    return source;
  }
  const failures = await runFix(docgenServer, {
    packageManager,
    result,
    mainConfigPath,
    mainConfig,
    configDir,
    storybookVersion: '11.0.0',
    storiesPaths: [],
  });
  if (failures.length > 0) {
    throw new Error(failures.map(({ message }) => message).join('\n'));
  }
  return vol.readFileSync(mainConfigPath, 'utf8') as string;
};

beforeEach(() => {
  vol.reset();
  vi.mocked(formatExistingFile).mockImplementation(async (_path, source) => source);
  vi.mocked(fsp.readFile).mockImplementation(vol.promises.readFile as typeof fsp.readFile);
  vi.mocked(fsp.writeFile).mockImplementation(vol.promises.writeFile as typeof fsp.writeFile);
});

afterEach(() => {
  vi.mocked(fsp.readFile).mockRestore();
  vi.mocked(fsp.writeFile).mockRestore();
});

describe('docgen-server transform', () => {
  it('renames a boolean without changing surrounding config', async () => {
    expect(await migrate(deprecatedFalse)).toMatchInlineSnapshot(
      `"export default { features: { docgenServer: false } };"`
    );
  });

  it('preserves a dynamic deprecated flag expression', async () => {
    expect(
      await migrate(
        "export default { features: { experimentalDocgenServer: process.env.DOCGEN === 'true' } };"
      )
    ).toMatchInlineSnapshot(
      `"export default { features: { docgenServer: process.env.DOCGEN === 'true' } };"`
    );
  });

  it('keeps stable true over deprecated false', async () => {
    expect(
      await migrate(
        'export default { features: { docgenServer: true, experimentalDocgenServer: false } };'
      )
    ).toMatchInlineSnapshot(`
      "export default { features: {
        docgenServer: true
      } };"
    `);
  });

  it('keeps stable false over deprecated true', async () => {
    expect(
      await migrate(
        'export default { features: { docgenServer: false, experimentalDocgenServer: true } };'
      )
    ).toMatchInlineSnapshot(`
      "export default { features: {
        docgenServer: false
      } };"
    `);
  });

  it('preserves React opt-out', async () => {
    expect(await migrate('export default { typescript: { reactDocgen: false } };'))
      .toMatchInlineSnapshot(`
      "export default {
        typescript: { reactDocgen: false },

        features: {
          docgenServer: false
        }
      };"
    `);
  });

  it('preserves RDT configuration including propFilter', async () => {
    expect(
      await migrate(
        "export default { typescript: { reactDocgen: 'react-docgen-typescript', reactDocgenTypescriptOptions: { propFilter: (prop) => prop.name !== 'hidden' } } };"
      )
    ).toMatchInlineSnapshot(`
      "export default {
        typescript: { reactDocgen: 'react-docgen-typescript', reactDocgenTypescriptOptions: { propFilter: (prop) => prop.name !== 'hidden' } },

        features: {
          docgenServer: false
        }
      };"
    `);
  });

  it('preserves Vue custom engine and tsconfig', async () => {
    expect(
      await migrate(
        "export default { framework: { name: '@storybook/vue3-vite', options: { docgen: { plugin: 'vue-component-meta', tsconfig: 'tsconfig.docs.json' } } } };",
        vue
      )
    ).toMatchInlineSnapshot(`
      "export default {
        framework: { name: '@storybook/vue3-vite', options: { docgen: { plugin: 'vue-component-meta', tsconfig: 'tsconfig.docs.json' } } },

        features: {
          docgenServer: false
        }
      };"
    `);
  });

  it.each(['true', 'false', "'vue-docgen-api'"])('preserves Vue docgen %s', async (docgen) => {
    expect(
      await migrate(
        `export default { framework: { name: '@storybook/vue3-vite', options: { docgen: ${docgen} } } };`,
        vue
      )
    ).toContain('docgenServer: false');
  });

  it('leaves a Vue string-form framework unchanged', async () => {
    const source = "export default { framework: '@storybook/vue3-vite' };";
    expect(await migrate(source, vue)).toBe(source);
  });

  it.each([true, false])(
    'removes deprecated flag %s where no docgen provider exists',
    async (enabled) => {
      expect(
        await migrate(
          `export default { stories: [], features: { experimentalDocgenServer: ${enabled} } };`,
          svelte
        )
      ).toMatchInlineSnapshot(`
        "export default {
          stories: []
        };"
      `);
    }
  );

  it.each([
    ['React legacy settings', 'export default { typescript: { reactDocgen: false } };'],
    ['Vue legacy settings', 'export default { framework: { options: { docgen: false } } };'],
  ])('ignores %s where no docgen provider exists', async (_name, source) => {
    expect(await migrate(source, svelte)).toBe(source);
  });

  it.each([
    'export default {};',
    'export default { features: { docgenServer: true }, typescript: { reactDocgen: false } };',
    "export default { typescript: { reactDocgen: 'react-docgen', reactDocgenTypescriptOptions: { propFilter: () => false } } };",
  ])('leaves defaults and stable flags unchanged: %s', async (source) => {
    expect(await migrate(source)).toBe(source);
  });

  it('does not treat Angular compodoc false as an opt-out', async () => {
    const source =
      "export default { framework: { name: '@storybook/angular-vite', options: { compodoc: false } } };";
    expect(await migrate(source, angular)).toBe(source);
  });

  it.each([
    [
      'export default { typescript: { reactDocgen: { plugin: "custom" } } };',
      'Cannot safely migrate dynamic typescript.reactDocgen',
    ],
    [
      'export default { typescript: { reactDocgen: process.env.DOCGEN } };',
      'Cannot safely migrate dynamic typescript.reactDocgen',
    ],
    [
      'export default { features: { docgenServer: enabled, experimentalDocgenServer: true } };',
      'Cannot safely combine dynamic docgen flags',
    ],
    [
      'export default { features: { docgenServer: true, experimentalDocgenServer: effect() } };',
      'Cannot safely combine dynamic docgen flags',
    ],
  ])('reports a manual migration for %s', async (source, reason) => {
    await expect(migrate(source)).rejects.toThrow(reason);
    expect(vol.readFileSync(mainConfigPath, 'utf8')).toBe(source);
  });

  it.each([
    'export default { ...shared };',
    'export default { features: { ...flags, experimentalDocgenServer: false } };',
  ])('refuses to rewrite a spread config: %s', async (source) => {
    await expect(migrate(source)).rejects.toThrow('because the target contains spread field');
    expect(vol.readFileSync(mainConfigPath, 'utf8')).toBe(source);
  });

  it('is idempotent', async () => {
    const migrated = await migrate(deprecatedFalse);
    expect(await migrate(migrated)).toBe(migrated);
  });
});

describe('docgen-server check', () => {
  beforeEach(() => {
    vol.fromJSON({ [mainConfigPath]: deprecatedFalse });
  });

  it.each([
    ['10.6.0', '11.0.0-alpha.1', true],
    ['10.6.0', '11.0.0', true],
    ['10.5.0', '10.6.0', false],
    ['11.0.0', '11.1.0', false],
    [undefined, '11.0.0', false],
  ])('checks upgrade %s to %s', async (beforeVersion, storybookVersion, expected) => {
    expect((await check(react, { beforeVersion, storybookVersion })) !== null).toBe(expected);
  });

  it('allows an explicitly requested migration on SB11', async () => {
    expect(await check(react, { beforeVersion: undefined, requested: true })).not.toBeNull();
  });

  it('does not migrate a requested SB10 project', async () => {
    expect(await check(react, { storybookVersion: '10.6.0', requested: true })).toBeNull();
  });

  it.each([
    [react, 'react'],
    [vue, 'vue'],
    [{ framework: '@storybook-vue/nuxt', stories: [] }, 'vue'],
    [angular, 'angular'],
    [svelte, 'other'],
    [{ framework: '@storybook/web-components-vite', stories: [] }, 'other'],
  ] satisfies [StorybookConfigRaw, string][])(
    'selects the %j docgen migration',
    async (mainConfig, framework) => {
      expect(await check(mainConfig)).toEqual({ framework });
    }
  );

  it('does not offer a migration when the source already has the stable flag', async () => {
    vol.fromJSON({ [mainConfigPath]: 'export default { features: { docgenServer: false } };' });
    expect(await check(react)).toBeNull();
  });
});
