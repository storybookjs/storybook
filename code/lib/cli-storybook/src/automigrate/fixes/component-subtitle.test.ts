import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JsPackageManager } from 'storybook/internal/common';

import { fs, vol } from 'memfs';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import {
  componentSubtitle,
  transformPreviewSource,
  transformStorySource,
} from './component-subtitle.ts';
describe('component-subtitle', () => {
  it('migrates local fallbacks consistently across meta and stories', () => {
    const transformed = transformStorySource(`
      export default { parameters: { componentSubtitle: 'Meta' } };
      export const Primary = { parameters: { componentSubtitle: 'Story' } };
    `);
    expect(transformed).toMatchInlineSnapshot(`
      "
            export default { parameters: { docs: {
                  subtitle: 'Meta'
            } } };
            export const Primary = { parameters: { docs: {
                  subtitle: 'Story'
            } } };
          "
    `);
  });

  it('moves a meta componentSubtitle value to docs.subtitle', () => {
    const transformed = transformStorySource(`
        export default {
          component: Button,
          parameters: { componentSubtitle: subtitle }
        };
      `);
    expect(transformed).toMatchInlineSnapshot(`
      "
              export default {
                component: Button,
                parameters: { docs: {
                  subtitle: subtitle
                } }
              };
            "
    `);
  });

  it('moves a componentSubtitle value from an identifier meta', () => {
    const transformed = transformStorySource(`
      const meta = {
        component: Button,
        parameters: { componentSubtitle: 'Legacy' }
      } satisfies Meta;
      export default meta;
    `);

    expect(transformed).toMatchInlineSnapshot(`
      "
            const meta = {
              component: Button,
              parameters: { docs: {
                subtitle: 'Legacy'
              } }
            } satisfies Meta;
            export default meta;
          "
    `);
  });

  it('migrates a separately exported story through CSF discovery', () => {
    expect(
      transformStorySource(`
        export default { component: Button };
        const Primary = { parameters: { componentSubtitle: 'Legacy' } };
        export { Primary };
      `)
    ).toMatchInlineSnapshot(`
      "
              export default { component: Button };
              const Primary = { parameters: { docs: {
                      subtitle: 'Legacy'
              } } };
              export { Primary };
            "
    `);
  });

  it('adds subtitle to an existing docs object in a story', () => {
    expect(
      transformStorySource(`
        export default { component: Button };
        export const Primary = {
          parameters: {
            componentSubtitle: 'Legacy',
            docs: { source: { type: 'code' } }
          }
        };
      `)
    ).toMatchInlineSnapshot(`
      "
              export default { component: Button };
              export const Primary = {
                parameters: {
                  docs: {
                    subtitle: 'Legacy',
                    source: { type: 'code' }
                  }
                }
              };
            "
    `);
  });

  it('migrates CSF2 story annotations', () => {
    const transformed = transformStorySource(`
        export default { component: Button };
        export const Primary = () => null;
        Primary.parameters = {
          componentSubtitle: 'Legacy'
        };
      `);

    expect(transformed).toMatchInlineSnapshot(`
      "
              export default { component: Button };
              export const Primary = () => null;
              Primary.parameters = {
                docs: {
                  subtitle: 'Legacy'
                }
              };
            "
    `);
  });

  it('migrates CSF4 story objects', () => {
    const transformed = transformStorySource(`
        import preview from './preview';
        const meta = preview.meta({ component: Button });
        export const Primary = meta.story({
          parameters: { componentSubtitle: 'Legacy' }
        });
      `);

    expect(transformed).toMatchInlineSnapshot(`
      "
              import preview from './preview';
              const meta = preview.meta({ component: Button });
              export const Primary = meta.story({
                parameters: { docs: {
                  subtitle: 'Legacy'
                } }
              });
            "
    `);
  });

  it('preserves an existing docs.subtitle', () => {
    expect(
      transformStorySource(`export default { parameters: {
      componentSubtitle: 'Legacy', docs: { subtitle: 'Current' }
    } };`)
    ).toMatchInlineSnapshot(`
      "export default { parameters: {
        docs: { subtitle: 'Current' }
      } };"
    `);
  });

  it('migrates preview parameters', () => {
    expect(
      transformPreviewSource(`
        export default {
          parameters: { componentSubtitle: 'Preview subtitle' }
        };
      `)
    ).toMatchInlineSnapshot(`
      "
              export default {
                parameters: { docs: {
                  subtitle: 'Preview subtitle'
                } }
              };
            "
    `);
  });

  it('migrates static computed keys without creating duplicate docs fields', () => {
    const transformed = transformStorySource(`
      export default {
        parameters: {
          ['componentSubtitle']: 'Legacy',
          ['docs']: { ['subtitle']: 'Current' }
        }
      };
    `);

    expect(transformed).toMatchInlineSnapshot(`
      "
            export default {
              parameters: {
                ['docs']: { ['subtitle']: 'Current' }
              }
            };
          "
    `);
  });

  it('ignores componentSubtitle text in a preview comment', () => {
    expect(
      transformPreviewSource(`
        // parameters.componentSubtitle was removed
        export default { parameters: {} };
      `)
    ).toBeNull();
  });

  it('migrates a uniquely referenced parameters object', () => {
    expect(
      transformStorySource(`
        const parameters = { componentSubtitle: 'Legacy' };
        export default { parameters };
      `)
    ).toMatchInlineSnapshot(`
      "
              const parameters = { docs: {
                      subtitle: 'Legacy'
              } };
              export default { parameters };
            "
    `);
  });
});

vi.mock('node:fs/promises', { spy: true });

describe('component-subtitle file processing', () => {
  const previewConfigPath = resolve('.storybook/preview.ts');
  const storyPath = resolve('Button.stories.ts');
  const options = {
    packageManager: vi.mocked(JsPackageManager.prototype),
    mainConfig: { stories: [] },
    mainConfigPath: resolve('.storybook/main.ts'),
    configDir: resolve('.storybook'),
    storybookVersion: '11.0.0',
    hasCsfFactoryPreview: false,
    previewConfigPath,
    storiesPaths: [storyPath],
  };
  const run = () => runFix(componentSubtitle, { ...options, result: { filesToChange: [] } });

  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vol.fromJSON({
      [previewConfigPath]: "export default { parameters: { componentSubtitle: 'Preview' } };",
      [storyPath]: "export default { parameters: { componentSubtitle: 'Story' } };",
    });
  });

  it('reports the files to change without writing them', async () => {
    const before = vol.toJSON();
    expect(await checkFix(componentSubtitle, options)).toEqual({
      filesToChange: [previewConfigPath, storyPath],
    });
    expect(vol.toJSON()).toEqual(before);
  });

  it('migrates the current preview and story contents', async () => {
    fs.writeFileSync(storyPath, "export default { parameters: { componentSubtitle: 'Edited' } };");
    await run();
    expect(fs.readFileSync(previewConfigPath, 'utf8')).toMatchInlineSnapshot(`
      "export default { parameters: { docs: {
        subtitle: 'Preview'
      } } };"
    `);
    expect(fs.readFileSync(storyPath, 'utf8')).toMatchInlineSnapshot(`
      "export default { parameters: { docs: {
        subtitle: 'Edited'
      } } };"
    `);
  });

  it('writes nothing when any file cannot be migrated safely', async () => {
    fs.writeFileSync(
      storyPath,
      "export default { parameters: { ...shared, componentSubtitle: 'Story' } };"
    );
    const before = vol.toJSON();
    await expect(checkFix(componentSubtitle, options)).rejects.toThrow(storyPath);
    await expect(run()).rejects.toThrow(storyPath);
    expect(vol.toJSON()).toEqual(before);
  });

  it('does not require a preview', async () => {
    await runFix(componentSubtitle, {
      ...options,
      previewConfigPath: undefined,
      result: { filesToChange: [] },
    });
    expect(fs.readFileSync(storyPath, 'utf8')).toContain('subtitle: ');
  });

  it('ignores unrelated dynamic docs config without a legacy subtitle', async () => {
    fs.writeFileSync(
      storyPath,
      "import docs from './docs'; export default { parameters: { docs } };"
    );
    expect(
      await checkFix(componentSubtitle, { ...options, previewConfigPath: undefined })
    ).toBeNull();
  });

  it('schedules the migration only when an upgrade crosses SB11', async () => {
    expect(
      await checkFix(componentSubtitle, { ...options, isUpgrade: true, beforeVersion: '10.6.0' })
    ).not.toBeNull();
    expect(
      await checkFix(componentSubtitle, { ...options, isUpgrade: true, beforeVersion: '11.0.0' })
    ).toBeNull();
  });

  it.each(['0.0.0-pr-36129-sha-d9438e2', 'portal:', 'workspace:*'])(
    'schedules the migration for an SB11 upgrade target %s',
    async (storybookVersion) => {
      expect(
        await checkFix(componentSubtitle, {
          ...options,
          isUpgrade: true,
          beforeVersion: '10.6.0',
          storybookVersion,
        })
      ).not.toBeNull();
    }
  );

  it('rejects a story migration when the preview subtitle can take precedence', async () => {
    fs.writeFileSync(
      previewConfigPath,
      "export default { parameters: { docs: { subtitle: 'Current' } } };"
    );
    const before = vol.toJSON();
    await expect(run()).rejects.toThrow(
      'An inherited parameters.docs.subtitle value can take precedence'
    );
    expect(vol.toJSON()).toEqual(before);
  });

  it('checks descendant subtitles in files without a legacy token', async () => {
    fs.writeFileSync(storyPath, "export default { parameters: { docs: { subtitle: '' } } };");
    const before = vol.toJSON();
    await expect(run()).rejects.toThrow(
      'A descendant parameters.docs.subtitle can hide an inherited componentSubtitle fallback'
    );
    expect(vol.toJSON()).toEqual(before);
  });

  it('does not migrate stories when preview parameters cannot be inspected', async () => {
    fs.writeFileSync(
      previewConfigPath,
      "import parameters from './parameters'; export default { parameters };"
    );
    const before = vol.toJSON();
    await expect(run()).rejects.toThrow(previewConfigPath);
    expect(vol.toJSON()).toEqual(before);
  });

  it('ignores an uninspectable preview when no subtitle migration is needed', async () => {
    fs.writeFileSync(
      previewConfigPath,
      "import parameters from './parameters'; export default { parameters };"
    );
    fs.writeFileSync(storyPath, 'export default { parameters: { docs: {} } };');

    expect(await checkFix(componentSubtitle, options)).toBeNull();
  });

  it('reports an unsafe preview legacy subtitle', async () => {
    fs.writeFileSync(
      previewConfigPath,
      "export default { parameters: { ...shared, componentSubtitle: 'Legacy' } };"
    );
    fs.writeFileSync(storyPath, 'export default { parameters: { docs: {} } };');

    await expect(checkFix(componentSubtitle, options)).rejects.toThrow(previewConfigPath);
  });

  it('migrates a named preview parameters export', async () => {
    fs.writeFileSync(
      previewConfigPath,
      "export const parameters = { componentSubtitle: 'Preview' };"
    );
    await run();
    expect(fs.readFileSync(previewConfigPath, 'utf8')).toMatchInlineSnapshot(`
      "export const parameters = { docs: {
        subtitle: 'Preview'
      } };"
    `);
  });
});
