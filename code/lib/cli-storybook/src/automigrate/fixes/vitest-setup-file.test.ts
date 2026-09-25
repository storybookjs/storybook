import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { dedent } from 'ts-dedent';
import { stripVTControlCharacters } from 'util';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { formatFileContent } from 'storybook/internal/common';
import { loadConfig } from 'storybook/internal/csf-tools';

import { transformSetupFile, vitestSetupFile } from './vitest-setup-file.ts';

vi.mock('storybook/internal/common', { spy: true });

const PREVIEW_ONLY_SETUP_FILE = dedent`
  import { setProjectAnnotations } from '@storybook/react-vite';
  import * as projectAnnotations from './preview';

  // This is an important step to apply the right configuration when testing your stories.
  // More info at: https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest#setprojectannotations
  setProjectAnnotations([projectAnnotations]);
`;

const A11Y_SETUP_FILE = dedent`
  import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';
  import { setProjectAnnotations } from '@storybook/react-vite';
  import * as projectAnnotations from './preview';

  setProjectAnnotations([a11yAddonAnnotations, projectAnnotations]);
`;

const SB_8_6_0_SETUP_FILE = dedent`
  import { beforeAll } from 'vitest';
  import { setProjectAnnotations } from '@storybook/react';
  import * as projectAnnotations from './preview';

  const project = setProjectAnnotations([projectAnnotations]);

  beforeAll(project.beforeAll);
`;

const CUSTOM_CODE_SETUP_FILE = dedent`
  import { setProjectAnnotations } from '@storybook/react-vite';
  import { MotionGlobalConfig } from 'framer-motion';
  import { beforeAll } from 'vitest';
  import * as previewAnnotations from './preview';

  // Skip animations
  MotionGlobalConfig.skipAnimations = true;

  // Apply Storybook's global decorators/parameters (SomeProvider, etc.) to all story tests
  const annotations = setProjectAnnotations([previewAnnotations]);
  beforeAll(annotations.beforeAll);
`;

const STANDARD_VITEST_CONFIG = dedent`
  import { defineConfig } from 'vitest/config';
  import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

  export default defineConfig({
    plugins: [storybookTest({ configDir: '.storybook' })],
    test: {
      setupFiles: ['./.storybook/vitest.setup.ts'],
    },
  });
`;

// A project that relies on the `extends` default to pick up the root's Storybook plugin
const ROOT_PLUGIN_PROJECT_CONFIG = dedent`
  import { defineConfig } from 'vitest/config';
  import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

  export default defineConfig({
    plugins: [storybookTest({ configDir: '.storybook' })],
    test: {
      projects: [
        {
          test: { name: 'storybook', setupFiles: ['./.storybook/vitest.setup.ts'] },
        },
      ],
    },
  });
`;

const MAIN_CONFIG = { addons: ['@storybook/addon-vitest', '@storybook/addon-a11y'] };

let fixtureRoot: string;
let installedVitestVersion: string | null = '4.0.0';

describe('vitestSetupFile', () => {
  describe('check', () => {
    it('returns null when @storybook/addon-vitest is not registered', async () => {
      const { result } = await check(
        { '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE },
        { addons: ['@storybook/addon-a11y'] }
      );

      expect(result).toBeNull();
    });

    it('detects the setup file when the plugin is used without the addon registered', async () => {
      const { result, setupFilePath } = await check(
        {
          '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
          'vitest.config.ts': STANDARD_VITEST_CONFIG,
        },
        { addons: ['@storybook/addon-a11y'] }
      );

      expect(result?.setupFiles).toEqual([{ path: setupFilePath, transform: { kind: 'empty' } }]);
    });

    it('returns null when there is no setup file', async () => {
      const { result } = await check({ 'vitest.config.ts': STANDARD_VITEST_CONFIG });

      expect(result).toBeNull();
    });

    it('returns null when the setup file does not reference setProjectAnnotations', async () => {
      const { result } = await check({
        '.storybook/vitest.setup.ts': "import '@testing-library/jest-dom/vitest';",
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });

      expect(result).toBeNull();
    });

    it('detects the setup file in configDir and the config referencing it', async () => {
      const { result, setupFilePath, configPath } = await check({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });

      expect(result).toEqual({
        setupFiles: [{ path: setupFilePath, transform: { kind: 'empty' } }],
        configFiles: [configPath],
        unresolvedEntries: [],
        inheritsRootByDefault: false,
      });
    });

    it('detects setup files outside configDir referenced from the config', async () => {
      const { result, configPath } = await check({
        'src/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE.replace(
          "'./preview'",
          "'../.storybook/preview'"
        ),
        'vitest.config.ts': STANDARD_VITEST_CONFIG.replace(
          './.storybook/vitest.setup.ts',
          './src/vitest.setup.ts'
        ),
      });

      expect(result).toEqual({
        setupFiles: [
          { path: path.join(fixtureRoot, 'src/vitest.setup.ts'), transform: { kind: 'empty' } },
        ],
        configFiles: [configPath],
        unresolvedEntries: [],
        inheritsRootByDefault: false,
      });
    });
  });

  describe('run', () => {
    it('deletes a setup file that only applies the preview and removes its setupFiles entry', async () => {
      const { setupFilePath, configPath } = await migrate({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });

      expect(existsSync(setupFilePath)).toBe(false);

      const updatedConfig = readFixture('vitest.config.ts');
      expect(updatedConfig).toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';
        import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

        export default defineConfig({
          plugins: [storybookTest({ configDir: '.storybook' })],
          test: {},
        });"
      `);
      loadConfig(updatedConfig, configPath);
    });

    it('keeps the setup file when its config entry cannot be rewritten', async () => {
      const { result, setupFilePath } = await check({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });
      vi.mocked(formatFileContent).mockRejectedValueOnce(new Error('formatter crashed'));

      await expect(
        vitestSetupFile.run?.({ result: result!, dryRun: false } as any)
      ).rejects.toThrow('formatter crashed');

      // Deleting the file first would leave vitest.config.ts pointing at a file that no longer exists
      expect(existsSync(setupFilePath)).toBe(true);
      expect(readFixture('.storybook/vitest.setup.ts')).toBe(PREVIEW_ONLY_SETUP_FILE);
      expect(readFixture('vitest.config.ts')).toBe(STANDARD_VITEST_CONFIG);
    });

    it('removes the deleted setup file entry when paths are relative to a custom root', async () => {
      const fixture = createFixture({
        'app/.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': dedent`
          import { defineConfig } from 'vitest/config';
          import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

          export default defineConfig({
            root: './app',
            plugins: [storybookTest({ configDir: './app/.storybook' })],
            test: {
              setupFiles: ['./.storybook/vitest.setup.ts'],
            },
          });
        `,
      });
      const configDir = path.join(fixtureRoot, 'app/.storybook');
      expect(existsSync(path.join(configDir, 'vitest.setup.ts'))).toBe(true);

      const result = await vitestSetupFile.check({
        mainConfig: MAIN_CONFIG,
        configDir,
        packageManager: fixture.packageManager,
      } as any);

      expect(result).not.toBeNull();
      await vitestSetupFile.run?.({ result, dryRun: false } as any);

      expect(existsSync(path.join(configDir, 'vitest.setup.ts'))).toBe(false);
      const updatedConfig = readFixture('vitest.config.ts');
      expect(updatedConfig).not.toContain('./.storybook/vitest.setup.ts');
      loadConfig(updatedConfig, fixture.configPath);
    });

    it('resolves inherited setupFiles against the child project root', async () => {
      const fixture = createFixture({
        'child/.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': dedent`
          import { defineConfig } from 'vitest/config';
          import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

          export default defineConfig({
            test: {
              setupFiles: ['./.storybook/vitest.setup.ts'],
              projects: [
                {
                  extends: true,
                  root: './child',
                  plugins: [storybookTest({ configDir: './child/.storybook' })],
                  test: { name: 'storybook' },
                },
              ],
            },
          });
        `,
      });
      const configDir = path.join(fixtureRoot, 'child/.storybook');
      const result = await vitestSetupFile.check({
        mainConfig: MAIN_CONFIG,
        configDir,
        packageManager: fixture.packageManager,
      } as any);

      expect(result).not.toBeNull();
      await vitestSetupFile.run?.({ result, dryRun: false } as any);

      expect(existsSync(path.join(configDir, 'vitest.setup.ts'))).toBe(false);
      const updatedConfig = readFixture('vitest.config.ts');
      expect(updatedConfig).not.toContain('setupFiles');
      loadConfig(updatedConfig, fixture.configPath);
    });

    it('refuses to delete a setup file when its root cannot be resolved statically', async () => {
      const configSource = dedent`
        import { defineConfig } from 'vitest/config';
        import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

        const appRoot = process.env.APP_ROOT ?? './app';

        export default defineConfig({
          root: appRoot,
          plugins: [storybookTest({ configDir: './app/.storybook' })],
          test: {
            setupFiles: ['./.storybook/vitest.setup.ts'],
          },
        });
      `;
      const fixture = createFixture({
        'app/.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': configSource,
      });
      const configDir = path.join(fixtureRoot, 'app/.storybook');
      const result = await vitestSetupFile.check({
        mainConfig: MAIN_CONFIG,
        configDir,
        packageManager: fixture.packageManager,
      } as any);

      expect(result).not.toBeNull();
      await expect(vitestSetupFile.run?.({ result, dryRun: false } as any)).rejects.toThrow();

      expect(readFixture('app/.storybook/vitest.setup.ts')).toBe(PREVIEW_ONLY_SETUP_FILE);
      expect(readFixture('vitest.config.ts')).toBe(configSource);
    });

    it('resolves setup files against test.root in preference to the top-level root', async () => {
      const fixture = createFixture({
        'app/.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': dedent`
          import { defineConfig } from 'vitest/config';
          import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

          export default defineConfig({
            root: '.',
            plugins: [storybookTest({ configDir: './app/.storybook' })],
            test: {
              root: './app',
              setupFiles: ['./.storybook/vitest.setup.ts'],
            },
          });
        `,
      });
      const configDir = path.join(fixtureRoot, 'app/.storybook');
      const result = await vitestSetupFile.check({
        mainConfig: MAIN_CONFIG,
        configDir,
        packageManager: fixture.packageManager,
      } as any);

      expect(result).not.toBeNull();
      await vitestSetupFile.run?.({ result, dryRun: false } as any);

      expect(existsSync(path.join(configDir, 'vitest.setup.ts'))).toBe(false);
      const updatedConfig = readFixture('vitest.config.ts');
      expect(updatedConfig).not.toContain('./.storybook/vitest.setup.ts');
      loadConfig(updatedConfig, fixture.configPath);
    });

    it('deletes a setup file that also applies addon-a11y when the addon is registered', async () => {
      const { setupFilePath } = await migrate({
        '.storybook/vitest.setup.ts': A11Y_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });

      expect(existsSync(setupFilePath)).toBe(false);
      expect(readFixture('vitest.config.ts')).toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';
        import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

        export default defineConfig({
          plugins: [storybookTest({ configDir: '.storybook' })],
          test: {},
        });"
      `);
    });

    it('refuses a setup file applying addon-a11y when the addon is not registered', async () => {
      const error = await migrateAndCaptureError(
        {
          '.storybook/vitest.setup.ts': A11Y_SETUP_FILE,
          'vitest.config.ts': STANDARD_VITEST_CONFIG,
        },
        { addons: ['@storybook/addon-vitest'] }
      );

      expect(error).toMatchInlineSnapshot(`
        "The vitest-setup-file automigration couldn't migrate your Vitest setup file(s) automatically, but here are instructions for doing it yourself:

        1) <fixture>/.storybook/vitest.setup.ts: it passes "@storybook/addon-a11y/preview" annotations, but @storybook/addon-a11y is not registered in the "addons" field of your .storybook/main

        @storybook/addon-vitest applies your project annotations itself: your .storybook/preview file and the previews of the addons registered in .storybook/main. setProjectAnnotations replaces those annotations, so it must not be called from a Vitest setup file. For each file listed above:
          1. If the call only passes your .storybook/preview annotations, delete the call.
          2. If it passes an addon's annotations, register that addon in the addons field of .storybook/main and delete the call.
          3. If it passes custom annotations, move them into .storybook/preview and delete the call.
          4. If nothing else remains in the file, delete it and remove its entry from setupFiles in your Vitest config.
          5. If the file is shared with a Vitest project that uses portable stories directly, list it only in that project's setupFiles.

        Read more: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-setprojectannotations-must-not-be-called-in-setup-files"
      `);
      expect(readFixture('.storybook/vitest.setup.ts')).toBe(A11Y_SETUP_FILE);
      expect(readFixture('vitest.config.ts')).toBe(STANDARD_VITEST_CONFIG);
    });

    it('deletes the setup file generated by Storybook 8.6.0', async () => {
      const { setupFilePath } = await migrate({
        '.storybook/vitest.setup.ts': SB_8_6_0_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });

      expect(existsSync(setupFilePath)).toBe(false);
    });

    it('removes the call but keeps a setup file with other code', async () => {
      const { setupFilePath } = await migrate({
        '.storybook/vitest.setup.ts': CUSTOM_CODE_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });

      expect(existsSync(setupFilePath)).toBe(true);
      expect(readFixture('.storybook/vitest.setup.ts')).toMatchInlineSnapshot(`
        "import { MotionGlobalConfig } from 'framer-motion';

        // Skip animations
        MotionGlobalConfig.skipAnimations = true;"
      `);
      expect(readFixture('vitest.config.ts')).toBe(STANDARD_VITEST_CONFIG);
    });

    it('keeps unrelated setupFiles entries', async () => {
      await migrate({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG.replace(
          "setupFiles: ['./.storybook/vitest.setup.ts'],",
          "setupFiles: ['./other-setup.ts', './.storybook/vitest.setup.ts'],"
        ),
      });

      expect(readFixture('vitest.config.ts')).toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';
        import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

        export default defineConfig({
          plugins: [storybookTest({ configDir: '.storybook' })],
          test: {
            setupFiles: ['./other-setup.ts'],
          },
        });"
      `);
    });

    it('removes a string-valued entry from a nested test.projects entry extending the root', async () => {
      await migrate({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': dedent`
          import { defineConfig } from 'vitest/config';
          import { storybookTest as storybook } from '@storybook/addon-vitest/vitest-plugin';

          export default defineConfig({
            plugins: [storybook({ configDir: '.storybook' })],
            test: {
              projects: [
                {
                  extends: true,
                  test: {
                    setupFiles: './.storybook/vitest.setup.ts',
                  },
                },
              ],
            },
          });
        `,
      });

      expect(readFixture('vitest.config.ts')).toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';
        import { storybookTest as storybook } from '@storybook/addon-vitest/vitest-plugin';

        export default defineConfig({
          plugins: [storybook({ configDir: '.storybook' })],
          test: {
            projects: [
              {
                extends: true,
                test: {},
              },
            ],
          },
        });"
      `);
    });

    it('recognizes the plugin behind a namespace import', async () => {
      const { setupFilePath } = await migrate({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': dedent`
          import { defineConfig } from 'vitest/config';
          import * as vitestPlugin from '@storybook/addon-vitest/vitest-plugin';

          export default defineConfig({
            plugins: [vitestPlugin.storybookTest({ configDir: '.storybook' })],
            test: {
              setupFiles: ['./.storybook/vitest.setup.ts'],
            },
          });
        `,
      });

      expect(existsSync(setupFilePath)).toBe(false);
      expect(readFixture('vitest.config.ts')).toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';
        import * as vitestPlugin from '@storybook/addon-vitest/vitest-plugin';

        export default defineConfig({
          plugins: [vitestPlugin.storybookTest({ configDir: '.storybook' })],
          test: {},
        });"
      `);
    });

    it('resolves path.join(import.meta.dirname, ...) and __dirname entries', async () => {
      const { setupFilePath } = await migrate({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': dedent`
          import { defineConfig } from 'vitest/config';
          import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
          import path from 'path';

          export default defineConfig({
            plugins: [storybookTest({ configDir: '.storybook' })],
            test: {
              setupFiles: [
                path.join(import.meta.dirname, '.storybook/vitest.setup.ts'),
                path.resolve(__dirname, \`./.storybook/vitest.setup.ts\`),
                './other-setup.ts',
              ],
            },
          });
        `,
      });

      expect(existsSync(setupFilePath)).toBe(false);
      expect(readFixture('vitest.config.ts')).toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';
        import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
        import path from 'path';

        export default defineConfig({
          plugins: [storybookTest({ configDir: '.storybook' })],
          test: {
            setupFiles: ['./other-setup.ts'],
          },
        });"
      `);
    });

    it('refuses to delete a setup file while a setupFiles entry cannot be resolved', async () => {
      const config = dedent`
        import { defineConfig } from 'vitest/config';

        const setupFile = process.env.CI ? './ci-setup.ts' : './.storybook/vitest.setup.ts';

        export default defineConfig({
          test: {
            setupFiles: [setupFile],
          },
        });
      `;
      const error = await migrateAndCaptureError({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': config,
      });

      expect(error).toMatchInlineSnapshot(`
        "The vitest-setup-file automigration couldn't migrate your Vitest setup file(s) automatically, but here are instructions for doing it yourself:

        1) <fixture>/vitest.config.ts: setupFile is computed at runtime, so the setupFiles it selects can't be matched without executing your config

        @storybook/addon-vitest applies your project annotations itself: your .storybook/preview file and the previews of the addons registered in .storybook/main. setProjectAnnotations replaces those annotations, so it must not be called from a Vitest setup file. For each file listed above:
          1. If the call only passes your .storybook/preview annotations, delete the call.
          2. If it passes an addon's annotations, register that addon in the addons field of .storybook/main and delete the call.
          3. If it passes custom annotations, move them into .storybook/preview and delete the call.
          4. If nothing else remains in the file, delete it and remove its entry from setupFiles in your Vitest config.
          5. If the file is shared with a Vitest project that uses portable stories directly, list it only in that project's setupFiles.

        Read more: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-setprojectannotations-must-not-be-called-in-setup-files"
      `);
      expect(readFixture('.storybook/vitest.setup.ts')).toBe(PREVIEW_ONLY_SETUP_FILE);
      expect(readFixture('vitest.config.ts')).toBe(config);
    });

    it('rewrites a kept setup file even when a setupFiles entry cannot be resolved', async () => {
      const config = dedent`
        import { defineConfig } from 'vitest/config';

        export default defineConfig({
          test: {
            setupFiles: [process.env.SETUP_FILE],
          },
        });
      `;
      await migrate({
        '.storybook/vitest.setup.ts': CUSTOM_CODE_SETUP_FILE,
        'vitest.config.ts': config,
      });

      expect(readFixture('.storybook/vitest.setup.ts')).not.toContain('setProjectAnnotations');
      expect(readFixture('vitest.config.ts')).toBe(config);
    });

    it('skips a setup file only loaded by projects without the Storybook plugin', async () => {
      const { result } = await check({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': dedent`
          import { defineConfig } from 'vitest/config';
          import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

          export default defineConfig({
            test: {
              projects: [
                {
                  plugins: [storybookTest({ configDir: '.storybook' })],
                  test: { name: 'storybook' },
                },
                {
                  test: {
                    name: 'portable-stories',
                    setupFiles: ['./.storybook/vitest.setup.ts'],
                  },
                },
              ],
            },
          });
        `,
      });

      expect(result).toBeNull();
    });

    it('refuses a setup file shared with a project without the Storybook plugin', async () => {
      const config = dedent`
        import { defineConfig } from 'vitest/config';
        import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

        export default defineConfig({
          test: {
            projects: [
              {
                plugins: [storybookTest({ configDir: '.storybook' })],
                test: { name: 'storybook', setupFiles: ['./.storybook/vitest.setup.ts'] },
              },
              {
                test: { name: 'portable-stories', setupFiles: ['./.storybook/vitest.setup.ts'] },
              },
            ],
          },
        });
      `;
      const error = await migrateAndCaptureError({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': config,
      });

      expect(error).toMatchInlineSnapshot(`
        "The vitest-setup-file automigration couldn't migrate your Vitest setup file(s) automatically, but here are instructions for doing it yourself:

        1) <fixture>/.storybook/vitest.setup.ts: it is also listed in "setupFiles" of a Vitest project without the Storybook plugin (<fixture>/vitest.config.ts), so its "setProjectAnnotations" call is still needed there; remove the file from the Storybook project's "setupFiles" instead

        @storybook/addon-vitest applies your project annotations itself: your .storybook/preview file and the previews of the addons registered in .storybook/main. setProjectAnnotations replaces those annotations, so it must not be called from a Vitest setup file. For each file listed above:
          1. If the call only passes your .storybook/preview annotations, delete the call.
          2. If it passes an addon's annotations, register that addon in the addons field of .storybook/main and delete the call.
          3. If it passes custom annotations, move them into .storybook/preview and delete the call.
          4. If nothing else remains in the file, delete it and remove its entry from setupFiles in your Vitest config.
          5. If the file is shared with a Vitest project that uses portable stories directly, list it only in that project's setupFiles.

        Read more: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-setprojectannotations-must-not-be-called-in-setup-files"
      `);
      expect(readFixture('.storybook/vitest.setup.ts')).toBe(PREVIEW_ONLY_SETUP_FILE);
      expect(readFixture('vitest.config.ts')).toBe(config);
    });

    it('refuses to rewrite a setup file with an unresolved portable-stories reference', async () => {
      const config = dedent`
        import { defineConfig } from 'vitest/config';
        import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

        const portableSetup = './.storybook/vitest.setup.ts';

        export default defineConfig({
          test: {
            projects: [
              {
                plugins: [storybookTest({ configDir: '.storybook' })],
                test: { name: 'storybook', setupFiles: ['./.storybook/vitest.setup.ts'] },
              },
              {
                test: { name: 'portable-stories', setupFiles: [portableSetup] },
              },
            ],
          },
        });
      `;
      const { result } = await check({
        '.storybook/vitest.setup.ts': CUSTOM_CODE_SETUP_FILE,
        'vitest.config.ts': config,
      });

      expect(result).not.toBeNull();
      await expect(
        vitestSetupFile.run?.({ result: result!, dryRun: false } as any)
      ).rejects.toThrow('automigration');
      expect(readFixture('.storybook/vitest.setup.ts')).toBe(CUSTOM_CODE_SETUP_FILE);
      expect(readFixture('vitest.config.ts')).toBe(config);
    });

    it('skips a portable-stories setup file when the project disables root config inheritance', async () => {
      const config = dedent`
        import { defineConfig } from 'vitest/config';
        import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

        export default defineConfig({
          plugins: [storybookTest({ configDir: '.storybook' })],
          test: {
            projects: [
              {
                extends: false,
                test: {
                  name: 'portable-stories',
                  setupFiles: ['./.storybook/vitest.setup.ts'],
                },
              },
            ],
          },
        });
      `;
      const { result } = await check({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': config,
      });

      expect(result).toBeNull();
      expect(readFixture('.storybook/vitest.setup.ts')).toBe(PREVIEW_ONLY_SETUP_FILE);
      expect(readFixture('vitest.config.ts')).toBe(config);
    });

    it('refuses a root setup file inherited by Storybook and portable-stories projects', async () => {
      const config = dedent`
        import { defineConfig } from 'vitest/config';
        import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

        export default defineConfig({
          test: {
            setupFiles: ['./.storybook/vitest.setup.ts'],
            projects: [
              {
                extends: true,
                plugins: [storybookTest({ configDir: '.storybook' })],
                test: { name: 'storybook' },
              },
              {
                extends: true,
                test: { name: 'portable-stories' },
              },
            ],
          },
        });
      `;
      const { result } = await check({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': config,
      });

      expect(result).not.toBeNull();
      await expect(
        vitestSetupFile.run?.({ result: result!, dryRun: false } as any)
      ).rejects.toThrow('automigration');
      expect(readFixture('.storybook/vitest.setup.ts')).toBe(PREVIEW_ONLY_SETUP_FILE);
      expect(readFixture('vitest.config.ts')).toBe(config);
    });

    it('refuses a setup file of a project whose plugins are merged in from elsewhere', async () => {
      const config = dedent`
        import { defineConfig, mergeConfig } from 'vitest/config';
        import viteConfig from './vite.config';

        export default mergeConfig(
          viteConfig,
          defineConfig({
            test: {
              setupFiles: ['./.storybook/vitest.setup.ts'],
            },
          })
        );
      `;
      const error = await migrateAndCaptureError({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': config,
      });

      expect(error).toContain(
        `1) <fixture>/.storybook/vitest.setup.ts: it is listed in "setupFiles" of a Vitest project whose plugins can't be read statically (<fixture>/vitest.config.ts)`
      );
      expect(readFixture('.storybook/vitest.setup.ts')).toBe(PREVIEW_ONLY_SETUP_FILE);
      expect(readFixture('vitest.config.ts')).toBe(config);
    });

    it('refuses a setup file of a project that extends a config file', async () => {
      const config = dedent`
        import { defineConfig } from 'vitest/config';

        export default defineConfig({
          test: {
            projects: [
              {
                extends: './vite.config.ts',
                test: { name: 'storybook', setupFiles: ['./.storybook/vitest.setup.ts'] },
              },
            ],
          },
        });
      `;
      const error = await migrateAndCaptureError({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vite.config.ts': "import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';",
        'vitest.config.ts': config,
      });

      expect(error).toContain(
        `1) <fixture>/.storybook/vitest.setup.ts: it is listed in "setupFiles" of a Vitest project whose plugins can't be read statically (<fixture>/vitest.config.ts)`
      );
      expect(readFixture('.storybook/vitest.setup.ts')).toBe(PREVIEW_ONLY_SETUP_FILE);
    });

    it('lets a project without extends inherit the root plugins on Vitest 5', async () => {
      installedVitestVersion = '5.0.0';
      const { setupFilePath } = await migrate({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': ROOT_PLUGIN_PROJECT_CONFIG,
      });

      expect(existsSync(setupFilePath)).toBe(false);
      expect(readFixture('vitest.config.ts')).not.toContain('vitest.setup.ts');
    });

    it('keeps a project without extends standalone on Vitest 4', async () => {
      const { result } = await check({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': ROOT_PLUGIN_PROJECT_CONFIG,
      });

      expect(result).toBeNull();
    });

    it('refuses a project without extends when the Vitest version is unknown', async () => {
      installedVitestVersion = null;
      const error = await migrateAndCaptureError({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': ROOT_PLUGIN_PROJECT_CONFIG,
      });

      expect(error).toContain(
        `1) <fixture>/.storybook/vitest.setup.ts: it is listed in "setupFiles" of a Vitest project whose plugins can't be read statically (<fixture>/vitest.config.ts)`
      );
      expect(readFixture('.storybook/vitest.setup.ts')).toBe(PREVIEW_ONLY_SETUP_FILE);
    });

    it('accepts a relative configDir without matching the same setup file twice', async () => {
      const fixture = createFixture({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });
      const result = await vitestSetupFile.check({
        mainConfig: MAIN_CONFIG,
        configDir: path.relative(process.cwd(), fixture.configDir),
        packageManager: fixture.packageManager,
      } as any);

      expect(result?.setupFiles).toEqual([
        { path: fixture.setupFilePath, transform: { kind: 'empty' } },
      ]);
      await vitestSetupFile.run?.({ result: result!, dryRun: false } as any);

      expect(existsSync(fixture.setupFilePath)).toBe(false);
      expect(readFixture('vitest.config.ts')).not.toContain('vitest.setup.ts');
    });

    it('refuses to delete a setup file that no scanned config references', async () => {
      const error = await migrateAndCaptureError({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.storybook.config.ts': STANDARD_VITEST_CONFIG,
      });

      expect(error).toContain(
        '1) <fixture>/.storybook/vitest.setup.ts: no Vitest or Vite config listing it in "setupFiles" was found'
      );
      expect(readFixture('.storybook/vitest.setup.ts')).toBe(PREVIEW_ONLY_SETUP_FILE);
      expect(readFixture('vitest.storybook.config.ts')).toBe(STANDARD_VITEST_CONFIG);
    });

    it('still rewrites an unreferenced setup file that keeps other code', async () => {
      await migrate({ '.storybook/vitest.setup.ts': CUSTOM_CODE_SETUP_FILE });

      expect(readFixture('.storybook/vitest.setup.ts')).not.toContain('setProjectAnnotations');
    });

    it('finds setupFiles entries in .mts and .cts configs', async () => {
      const { setupFilePath } = await migrate({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vite.config.mts': STANDARD_VITEST_CONFIG,
      });

      expect(existsSync(setupFilePath)).toBe(false);
      expect(readFixture('vite.config.mts')).not.toContain('vitest.setup.ts');
    });

    it('refuses a root setup file when the projects are not readable statically', async () => {
      const config = dedent`
        import { defineConfig } from 'vitest/config';
        import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

        const projects = [
          {
            extends: true,
            plugins: [storybookTest({ configDir: '.storybook' })],
            test: { name: 'storybook' },
          },
          { extends: true, test: { name: 'unit' } },
        ];

        export default defineConfig({
          test: {
            setupFiles: ['./.storybook/vitest.setup.ts'],
            projects,
          },
        });
      `;
      const error = await migrateAndCaptureError({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': config,
      });

      expect(error).toContain("whose plugins can't be read statically");
      expect(readFixture('.storybook/vitest.setup.ts')).toBe(PREVIEW_ONLY_SETUP_FILE);
      expect(readFixture('vitest.config.ts')).toBe(config);
    });

    it('refuses a root setup file when the projects array is spread', async () => {
      const config = dedent`
        import { defineConfig } from 'vitest/config';
        import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
        import { sharedProjects } from './vitest.projects';

        export default defineConfig({
          plugins: [storybookTest({ configDir: '.storybook' })],
          test: {
            setupFiles: ['./.storybook/vitest.setup.ts'],
            projects: [...sharedProjects, { extends: true, test: { name: 'storybook' } }],
          },
        });
      `;
      const error = await migrateAndCaptureError({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': config,
      });

      expect(error).toContain("whose plugins can't be read statically");
      expect(readFixture('.storybook/vitest.setup.ts')).toBe(PREVIEW_ONLY_SETUP_FILE);
    });

    it('leaves everything untouched on a dry run', async () => {
      const fixture = await check({
        '.storybook/vitest.setup.ts': PREVIEW_ONLY_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });
      await vitestSetupFile.run?.({ result: fixture.result!, dryRun: true } as any);

      expect(readFixture('.storybook/vitest.setup.ts')).toBe(PREVIEW_ONLY_SETUP_FILE);
      expect(readFixture('vitest.config.ts')).toBe(STANDARD_VITEST_CONFIG);
    });

    it('throws numbered manual instructions for every file it cannot migrate', async () => {
      const error = await migrateAndCaptureError({
        '.storybook/vitest.setup.ts': dedent`
          import { setProjectAnnotations } from '@storybook/react-vite';

          setProjectAnnotations([{ initialGlobals: { theme: 'dark' } }]);
        `,
        'src/vitest.setup.ts': dedent`
          import { setProjectAnnotations } from '@storybook/react-vite';
          import * as projectAnnotations from '../.storybook/preview';

          const annotations = setProjectAnnotations([projectAnnotations]);

          export const decorators = annotations.decorators;
        `,
        'vitest.config.ts': STANDARD_VITEST_CONFIG.replace(
          "setupFiles: ['./.storybook/vitest.setup.ts'],",
          "setupFiles: ['./.storybook/vitest.setup.ts', './src/vitest.setup.ts'],"
        ),
      });

      expect(error).toMatchInlineSnapshot(`
        "The vitest-setup-file automigration couldn't migrate your Vitest setup file(s) automatically, but here are instructions for doing it yourself:

        1) <fixture>/.storybook/vitest.setup.ts: it passes annotations that are neither your ".storybook/preview" nor "@storybook/addon-a11y/preview": { initialGlobals: { theme: 'dark' } }

        2) <fixture>/src/vitest.setup.ts: the value returned by "setProjectAnnotations" is used for more than forwarding "beforeAll"

        @storybook/addon-vitest applies your project annotations itself: your .storybook/preview file and the previews of the addons registered in .storybook/main. setProjectAnnotations replaces those annotations, so it must not be called from a Vitest setup file. For each file listed above:
          1. If the call only passes your .storybook/preview annotations, delete the call.
          2. If it passes an addon's annotations, register that addon in the addons field of .storybook/main and delete the call.
          3. If it passes custom annotations, move them into .storybook/preview and delete the call.
          4. If nothing else remains in the file, delete it and remove its entry from setupFiles in your Vitest config.
          5. If the file is shared with a Vitest project that uses portable stories directly, list it only in that project's setupFiles.

        Read more: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-setprojectannotations-must-not-be-called-in-setup-files"
      `);
      expect(readFixture('vitest.config.ts')).toBe(
        STANDARD_VITEST_CONFIG.replace(
          "setupFiles: ['./.storybook/vitest.setup.ts'],",
          "setupFiles: ['./.storybook/vitest.setup.ts', './src/vitest.setup.ts'],"
        )
      );
    });
  });
});

describe('transformSetupFile', () => {
  const options = {
    setupFilePath: '/project/.storybook/vitest.setup.ts',
    configDir: '/project/.storybook',
    a11yRegistered: true,
  };

  it('empties the pre-10.3 boilerplate', () => {
    expect(transformSetupFile(PREVIEW_ONLY_SETUP_FILE, options)).toEqual({ kind: 'empty' });
    expect(transformSetupFile(A11Y_SETUP_FILE, options)).toEqual({ kind: 'empty' });
    expect(transformSetupFile(SB_8_6_0_SETUP_FILE, options)).toEqual({ kind: 'empty' });
  });

  it('accepts a bare preview argument, a default preview import and a CSF factory preview', () => {
    expect(
      transformSetupFile(
        dedent`
          import { setProjectAnnotations } from '@storybook/vue3-vite';
          import * as projectAnnotations from './preview.ts';

          setProjectAnnotations(projectAnnotations);
        `,
        options
      )
    ).toEqual({ kind: 'empty' });

    expect(
      transformSetupFile(
        dedent`
          import { setProjectAnnotations } from '@storybook/react-vite';
          import sbAnnotations from './preview';

          setProjectAnnotations([sbAnnotations]);
        `,
        options
      )
    ).toEqual({ kind: 'empty' });

    expect(
      transformSetupFile(
        dedent`
          import { setProjectAnnotations } from 'storybook/internal/preview-api';
          import preview from './preview';

          setProjectAnnotations([preview.composed]);
        `,
        options
      )
    ).toEqual({ kind: 'empty' });
  });

  it('accepts an empty annotations array', () => {
    expect(
      transformSetupFile(
        dedent`
          import { setProjectAnnotations } from '@storybook/react-vite';

          setProjectAnnotations([]);
        `,
        options
      )
    ).toEqual({ kind: 'empty' });
  });

  it('keeps the rest of an import declaration that is still used', () => {
    expect(
      transformSetupFile(
        dedent`
          import { composeStories, setProjectAnnotations } from '@storybook/react-vite';
          import * as projectAnnotations from './preview';
          import * as stories from '../src/Button.stories';

          setProjectAnnotations([projectAnnotations]);

          export const { Primary } = composeStories(stories);
        `,
        options
      )
    ).toMatchInlineSnapshot(`
      {
        "code": "import { composeStories } from '@storybook/react-vite';
      import * as stories from '../src/Button.stories';

      export const { Primary } = composeStories(stories);",
        "kind": "rewritten",
      }
    `);
  });

  it('keeps an annotations import that is still used elsewhere', () => {
    expect(
      transformSetupFile(
        dedent`
          import { setProjectAnnotations } from '@storybook/react-vite';
          import * as projectAnnotations from './preview';

          setProjectAnnotations([projectAnnotations]);

          console.log(projectAnnotations.parameters);
        `,
        options
      )
    ).toMatchInlineSnapshot(`
      {
        "code": "import * as projectAnnotations from './preview';

      console.log(projectAnnotations.parameters);",
        "kind": "rewritten",
      }
    `);
  });

  it('reports annotations that are neither the preview nor addon-a11y', () => {
    expect(
      transformSetupFile(
        dedent`
          import { setProjectAnnotations } from '@storybook/react-vite';
          import * as themesAnnotations from '@storybook/addon-themes/preview';
          import * as projectAnnotations from './preview';

          setProjectAnnotations([themesAnnotations, projectAnnotations]);
        `,
        options
      )
    ).toMatchInlineSnapshot(`
      {
        "kind": "manual",
        "reason": "it passes annotations that are neither your ".storybook/preview" nor "@storybook/addon-a11y/preview": themesAnnotations",
      }
    `);

    expect(
      transformSetupFile(
        dedent`
          import { setProjectAnnotations } from '@storybook/react-vite';
          import * as projectAnnotations from '../other-storybook/preview';

          setProjectAnnotations([projectAnnotations]);
        `,
        options
      )
    ).toMatchInlineSnapshot(`
      {
        "kind": "manual",
        "reason": "it passes annotations that are neither your ".storybook/preview" nor "@storybook/addon-a11y/preview": projectAnnotations",
      }
    `);
  });

  it('reports a preview import that is not a module import', () => {
    expect(
      transformSetupFile(
        dedent`
          import { setProjectAnnotations } from '@storybook/react-vite';
          import { decorators } from './preview';

          setProjectAnnotations([{ decorators }]);
        `,
        options
      )
    ).toMatchInlineSnapshot(`
      {
        "kind": "manual",
        "reason": "it passes annotations that are neither your ".storybook/preview" nor "@storybook/addon-a11y/preview": { decorators }",
      }
    `);
  });

  it('reports addon-a11y annotations when the addon is not registered', () => {
    expect(transformSetupFile(A11Y_SETUP_FILE, { ...options, a11yRegistered: false }))
      .toMatchInlineSnapshot(`
        {
          "kind": "manual",
          "reason": "it passes "@storybook/addon-a11y/preview" annotations, but @storybook/addon-a11y is not registered in the "addons" field of your .storybook/main",
        }
      `);
  });

  it('reports a call that is wrapped or conditional', () => {
    expect(
      transformSetupFile(
        dedent`
          import { setProjectAnnotations } from '@storybook/react-vite';
          import * as projectAnnotations from './preview';

          if (process.env.STORYBOOK) {
            setProjectAnnotations([projectAnnotations]);
          }
        `,
        options
      )
    ).toMatchInlineSnapshot(`
      {
        "kind": "manual",
        "reason": "the "setProjectAnnotations" call is conditional or wrapped, so it cannot be removed safely",
      }
    `);
  });

  it('reports a captured result that is used for more than beforeAll', () => {
    expect(
      transformSetupFile(
        dedent`
          import { beforeAll } from 'vitest';
          import { setProjectAnnotations } from '@storybook/react-vite';
          import * as projectAnnotations from './preview';

          const project = setProjectAnnotations([projectAnnotations]);
          beforeAll(project.beforeAll);
          globalThis.projectAnnotations = project;
        `,
        options
      )
    ).toMatchInlineSnapshot(`
      {
        "kind": "manual",
        "reason": "the value returned by "setProjectAnnotations" is used for more than forwarding "beforeAll"",
      }
    `);
  });

  it('parses .tsx setup files with the tsx parser', () => {
    expect(
      transformSetupFile(
        dedent`
          import React from 'react';
          import { setProjectAnnotations } from '@storybook/react-vite';
          import * as projectAnnotations from './preview';

          setProjectAnnotations([
            projectAnnotations,
            { decorators: [(Story) => <div className="wrapper"><Story /></div>] },
          ]);
        `,
        { ...options, setupFilePath: '/project/.storybook/vitest.setup.tsx' }
      )
    ).toMatchObject({
      kind: 'manual',
      reason: expect.stringContaining('it passes annotations that are neither'),
    });
  });

  it('reports a setup file that cannot be parsed', () => {
    expect(
      transformSetupFile(
        dedent`
          import { setProjectAnnotations } from '@storybook/react-vite';

          setProjectAnnotations([
        `,
        options
      )
    ).toEqual({ kind: 'manual', reason: 'it could not be parsed' });
  });

  it('reports setProjectAnnotations imported from a non-Storybook module', () => {
    expect(
      transformSetupFile(
        dedent`
          import { setProjectAnnotations } from './test-utils';

          setProjectAnnotations();
        `,
        options
      )
    ).toMatchInlineSnapshot(`
      {
        "kind": "manual",
        "reason": "it does not import "setProjectAnnotations" from a Storybook package",
      }
    `);
  });
});

function normalize(output: string) {
  return stripVTControlCharacters(output)
    .replaceAll(fixtureRoot, '<fixture>')
    .replaceAll(fixtureRoot.replaceAll('\\', '/'), '<fixture>')
    .replaceAll('\\', '/');
}

function readFixture(filePath: string) {
  return normalize(readFileSync(path.join(fixtureRoot, filePath), 'utf8'));
}

async function check(files: Record<string, string>, mainConfig = MAIN_CONFIG) {
  const fixture = createFixture(files);
  const result = await vitestSetupFile.check({
    mainConfig,
    configDir: fixture.configDir,
    packageManager: fixture.packageManager,
  } as any);
  return { ...fixture, result };
}

async function migrate(files: Record<string, string>, mainConfig = MAIN_CONFIG) {
  const fixture = await check(files, mainConfig);
  await vitestSetupFile.run?.({ result: fixture.result!, dryRun: false } as any);
  return fixture;
}

async function migrateAndCaptureError(files: Record<string, string>, mainConfig = MAIN_CONFIG) {
  const fixture = await check(files, mainConfig);
  try {
    await vitestSetupFile.run?.({ result: fixture.result!, dryRun: false } as any);
  } catch (error) {
    return normalize(String(error instanceof Error ? error.message : error));
  }
  throw new Error('Expected the migration to refuse, but it succeeded');
}

function createFixture(files: Record<string, string>) {
  onTestFinished(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
    delete process.env.STORYBOOK_PROJECT_ROOT;
    installedVitestVersion = '4.0.0';
  });

  // findFilesUp stops at the project root by path comparison, so the symlinked macOS tmpdir must be resolved
  fixtureRoot = realpathSync(mkdtempSync(path.join(tmpdir(), 'storybook-vitest-setup-file-')));
  mkdirSync(path.join(fixtureRoot, 'node_modules'));

  for (const [filePath, content] of Object.entries(files)) {
    const absolutePath = path.join(fixtureRoot, filePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }

  // findFilesUp walks up to the project root; confine it to the fixture
  process.env.STORYBOOK_PROJECT_ROOT = fixtureRoot;

  return {
    configDir: path.join(fixtureRoot, '.storybook'),
    setupFilePath: path.join(fixtureRoot, '.storybook', 'vitest.setup.ts'),
    configPath: path.join(fixtureRoot, 'vitest.config.ts'),
    packageManager: {
      instanceDir: path.join(fixtureRoot, 'node_modules'),
      getInstalledVersion: async () => installedVitestVersion,
    },
  };
}
