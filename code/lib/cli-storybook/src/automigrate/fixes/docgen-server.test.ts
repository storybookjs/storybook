import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JsPackageManager } from 'storybook/internal/common';

import { vol } from 'memfs';

import type { CheckOptions } from '../types.ts';
import { angularViteRemoveCompodoc } from './angular-vite-remove-compodoc.ts';
import { docgenServer, transformDocgenServer } from './docgen-server.ts';

vi.mock('node:fs/promises', { spy: true });

const mainConfigPath = resolve('/project/.storybook/main.ts');
const source = 'export default { features: { experimentalDocgenServer: false } };';
const checkOptions: CheckOptions = {
  mainConfigPath,
  mainConfig: { framework: '@storybook/react-vite', stories: [] },
  packageManager: JsPackageManager.prototype,
  storybookVersion: '11.0.0-alpha.1',
  beforeVersion: '10.6.0',
  storiesPaths: [],
  hasCsfFactoryPreview: false,
};

beforeEach(() => {
  vol.reset();
  vol.fromJSON({ [mainConfigPath]: source });
  vi.mocked(readFile).mockImplementation(vol.promises.readFile as typeof readFile);
  vi.mocked(writeFile).mockImplementation(vol.promises.writeFile as typeof writeFile);
});

afterEach(() => {
  vi.mocked(readFile).mockReset();
  vi.mocked(writeFile).mockReset();
});

describe('transformDocgenServer', () => {
  it('renames a boolean without changing surrounding config', () => {
    expect(transformDocgenServer(source, 'react')).toMatchInlineSnapshot(
      `"export default { features: { docgenServer: false } };"`
    );
  });

  it('preserves a dynamic deprecated flag expression', () => {
    expect(
      transformDocgenServer(
        "export default { features: { experimentalDocgenServer: process.env.DOCGEN === 'true' } };",
        'react'
      )
    ).toMatchInlineSnapshot(
      `"export default { features: { docgenServer: process.env.DOCGEN === 'true' } };"`
    );
  });

  it('keeps stable true over deprecated false', () => {
    expect(
      transformDocgenServer(
        'export default { features: { docgenServer: true, experimentalDocgenServer: false } };',
        'react'
      )
    ).toMatchInlineSnapshot(`
      "export default { features: {
        docgenServer: true
      } };"
    `);
  });

  it('keeps stable false over deprecated true', () => {
    expect(
      transformDocgenServer(
        'export default { features: { docgenServer: false, experimentalDocgenServer: true } };',
        'react'
      )
    ).toMatchInlineSnapshot(`
      "export default { features: {
        docgenServer: false
      } };"
    `);
  });

  it('preserves React opt-out', () => {
    expect(transformDocgenServer('export default { typescript: { reactDocgen: false } };', 'react'))
      .toMatchInlineSnapshot(`
      "export default {
        typescript: { reactDocgen: false },

        features: {
          docgenServer: false
        }
      };"
    `);
  });

  it('preserves RDT configuration including propFilter', () => {
    expect(
      transformDocgenServer(
        "export default { typescript: { reactDocgen: 'react-docgen-typescript', reactDocgenTypescriptOptions: { propFilter: (prop) => prop.name !== 'hidden' } } };",
        'react'
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

  it('preserves Vue custom engine and tsconfig', () => {
    expect(
      transformDocgenServer(
        "export default { framework: { name: '@storybook/vue3-vite', options: { docgen: { plugin: 'vue-component-meta', tsconfig: 'tsconfig.docs.json' } } } };",
        'vue'
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

  it('preserves the Vue true shorthand', () => {
    expect(
      transformDocgenServer(
        "export default { framework: { name: '@storybook/vue3-vite', options: { docgen: true } } };",
        'vue'
      )
    ).toMatchInlineSnapshot(`
      "export default {
        framework: { name: '@storybook/vue3-vite', options: { docgen: true } },

        features: {
          docgenServer: false
        }
      };"
    `);
  });

  it.each([true, false])('leaves unsupported deprecated flag %s unchanged', async (enabled) => {
    const input = `export default { features: { experimentalDocgenServer: ${enabled} } };`;
    expect(transformDocgenServer(input, 'other')).toBe(input);
    vol.writeFileSync(mainConfigPath, input);
    await expect(
      docgenServer.check({
        ...checkOptions,
        mainConfig: { framework: '@storybook/svelte-vite', stories: [] },
      })
    ).resolves.toBeNull();
  });

  it('preserves Vue opt-out', () => {
    expect(
      transformDocgenServer(
        "export default { framework: { name: '@storybook/vue3-vite', options: { docgen: false } } };",
        'vue'
      )
    ).toMatchInlineSnapshot(`
      "export default {
        framework: { name: '@storybook/vue3-vite', options: { docgen: false } },

        features: {
          docgenServer: false
        }
      };"
    `);
  });

  it('preserves a Vue string docgen engine', () => {
    expect(
      transformDocgenServer(
        "export default { framework: { name: '@storybook/vue3-vite', options: { docgen: 'vue-docgen-api' } } };",
        'vue'
      )
    ).toContain('docgenServer: false');
  });

  it('does not apply a Vue object docgen setting to React', () => {
    expect(() =>
      transformDocgenServer(
        "export default { typescript: { reactDocgen: { plugin: 'custom' } } };",
        'react'
      )
    ).toThrow('Cannot safely migrate dynamic typescript.reactDocgen.');
  });

  it.each([
    'export default {};',
    'export default { features: { docgenServer: true }, typescript: { reactDocgen: false } };',
    "export default { typescript: { reactDocgen: 'react-docgen', reactDocgenTypescriptOptions: { propFilter: () => false } } };",
  ])('leaves defaults and stable flags unchanged: %s', (input) => {
    expect(transformDocgenServer(input, 'react')).toBe(input);
  });

  it('does not treat Angular compodoc false as an opt-out', () => {
    const input =
      "export default { framework: { name: '@storybook/angular-vite', options: { compodoc: false } } };";
    expect(transformDocgenServer(input, 'angular')).toBe(input);
  });

  it('does not apply React legacy settings to an unsupported framework', () => {
    const input = 'export default { typescript: { reactDocgen: false } };';
    expect(transformDocgenServer(input, 'other')).toBe(input);
  });

  it('does not apply Vue legacy settings to an unsupported framework', () => {
    const input = 'export default { framework: { options: { docgen: false } } };';
    expect(transformDocgenServer(input, 'other')).toBe(input);
  });

  it.each([
    'export default makeConfig();',
    'export default { ...shared };',
    'export default { features: flags };',
    'export default { features: { ...flags, experimentalDocgenServer: false } };',
    'export default { features: { docgenServer: enabled, experimentalDocgenServer: true } };',
    'export default { features: { docgenServer: true, experimentalDocgenServer: effect() } };',
    'export default { typescript: { reactDocgen: process.env.DOCGEN } };',
  ])('reports a manual migration for unsafe config: %s', (input) => {
    expect(() => transformDocgenServer(input, 'react')).toThrow(
      'Rename features.experimentalDocgenServer to features.docgenServer manually'
    );
  });

  it('identifies the unsafe mutation in its manual-migration error', () => {
    expect(() => transformDocgenServer('export default { ...shared };', 'react')).toThrow(
      'Cannot mutate features.experimentalDocgenServer because the target contains spread field; Cannot mutate features.docgenServer because the target contains spread field'
    );
  });

  it('is idempotent', () => {
    const transformed = transformDocgenServer(source, 'react');
    expect(transformDocgenServer(transformed, 'react')).toBe(transformed);
  });
});

describe('docgen-server migration', () => {
  it.each([{ docgenServer: false }, { docgenServer: false, experimentalDocgenServer: true }])(
    'keeps Angular Compodoc setup for stable opt-out %j',
    async (features) => {
      expect(
        await angularViteRemoveCompodoc.check({
          ...checkOptions,
          mainConfig: {
            framework: { name: '@storybook/angular-vite', options: { compodoc: true } },
            stories: [],
            features,
          },
        })
      ).toBeNull();
    }
  );
  it.each([
    ['10.6.0', '11.0.0-alpha.1', true],
    ['10.6.0', '11.0.0', true],
    ['10.5.0', '10.6.0', false],
    ['11.0.0', '11.1.0', false],
    [undefined, '11.0.0', false],
  ])('checks upgrade %s to %s', async (beforeVersion, storybookVersion, expected) => {
    const result = await docgenServer.check({ ...checkOptions, beforeVersion, storybookVersion });
    expect(result !== null).toBe(expected);
  });

  it('allows an explicitly requested migration on SB11', async () => {
    expect(
      await docgenServer.check({ ...checkOptions, beforeVersion: undefined, requested: true })
    ).not.toBeNull();
  });

  it.each([
    [{ framework: '@storybook/react-vite', stories: [] }, 'react'],
    [{ framework: '@storybook/vue3-vite', stories: [] }, 'vue'],
    [{ framework: '@storybook/angular-vite', stories: [] }, 'angular'],
  ] satisfies [CheckOptions['mainConfig'], string][])(
    'selects the %s docgen migration',
    async (mainConfig, framework) => {
      await expect(docgenServer.check({ ...checkOptions, mainConfig })).resolves.toEqual({
        mainConfigPath,
        framework,
      });
    }
  );

  it('does not migrate a requested SB10 project', async () => {
    expect(
      await docgenServer.check({ ...checkOptions, storybookVersion: '10.6.0', requested: true })
    ).toBeNull();
  });

  it('does not offer a migration when the source already has the stable flag', async () => {
    vol.writeFileSync(mainConfigPath, 'export default { features: { docgenServer: false } };');
    await expect(docgenServer.check(checkOptions)).resolves.toBeNull();
  });

  it('reads config files as UTF-8 when checking', async () => {
    await docgenServer.check(checkOptions);
    expect(readFile).toHaveBeenCalledWith(mainConfigPath, 'utf8');
  });

  it('writes the checked transform and leaves a dry run unchanged', async () => {
    const result = await docgenServer.check(checkOptions);
    if (!result || !docgenServer.run) {
      throw new Error('Expected a runnable migration');
    }
    const options = {
      ...checkOptions,
      mainConfigPath,
      configDir: resolve('/project/.storybook'),
      result,
    };
    await docgenServer.run({ ...options, dryRun: true });
    expect(vol.readFileSync(mainConfigPath, 'utf8')).toBe(source);
    await docgenServer.run(options);
    expect(vol.readFileSync(mainConfigPath, 'utf8')).toMatchInlineSnapshot(
      `"export default { features: { docgenServer: false } };"`
    );
  });

  it('preserves edits made by earlier migrations after checking', async () => {
    const result = await docgenServer.check(checkOptions);
    if (!result || !docgenServer.run) {
      throw new Error('Expected a runnable migration');
    }
    vol.writeFileSync(
      mainConfigPath,
      'export default { stories: [], features: { experimentalDocgenServer: false } };'
    );
    await docgenServer.run({
      ...checkOptions,
      mainConfigPath,
      configDir: resolve('/project/.storybook'),
      result,
    });
    expect(vol.readFileSync(mainConfigPath, 'utf8')).toMatchInlineSnapshot(
      `"export default { stories: [], features: { docgenServer: false } };"`
    );
  });

  it('does not rewrite an unchanged config when run with a checked result', async () => {
    vol.writeFileSync(mainConfigPath, 'export default { features: { docgenServer: false } };');
    await docgenServer.run!({
      ...checkOptions,
      mainConfigPath,
      configDir: resolve('/project/.storybook'),
      dryRun: false,
      result: { mainConfigPath, framework: 'react' },
    });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('reads config files as UTF-8 when running', async () => {
    await docgenServer.run!({
      ...checkOptions,
      mainConfigPath,
      configDir: resolve('/project/.storybook'),
      dryRun: true,
      result: { mainConfigPath, framework: 'react' },
    });
    expect(readFile).toHaveBeenCalledWith(mainConfigPath, 'utf8');
  });

  it('exposes the migration metadata used by the upgrade prompt', () => {
    expect(docgenServer.id).toBe('docgen-server');
    expect(docgenServer.link).toBe(
      'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#docgenserver-is-stable-and-enabled-by-default'
    );
    expect(docgenServer.prompt()).toBe(
      'Rename the docgenServer feature and preserve explicit legacy extraction settings'
    );
  });
});
