import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { stripVTControlCharacters } from 'util';
import { afterAll, describe, expect, it } from 'vitest';
import { dedent } from 'ts-dedent';

import { loadConfig } from 'storybook/internal/csf-tools';

import { vitestSetupFile } from './vitest-setup-file.ts';

const STANDARD_SETUP_FILE = dedent`
  import { setProjectAnnotations } from '@storybook/react-vite';
  import * as projectAnnotations from './preview';

  setProjectAnnotations([projectAnnotations]);
`;

const STANDARD_VITEST_CONFIG = dedent`
  import { defineConfig } from 'vitest/config';

  export default defineConfig({
    test: {
      setupFiles: ['./.storybook/vitest.setup.ts'],
    },
  });
`;

const WORKSPACE_CONFIG = dedent`
  import { defineWorkspace } from 'vitest/config';

  export default defineWorkspace([
    {
      test: {
        name: 'storybook',
        setupFiles: ['./.storybook/vitest.setup.ts'],
      },
    },
  ]);
`;

const PROJECTS_CONFIG = dedent`
  import { defineConfig } from 'vitest/config';

  export default defineConfig({
    test: {
      projects: [
        {
          test: {
            setupFiles: ['./.storybook/vitest.setup.ts'],
          },
        },
      ],
    },
  });
`;

/** The shape Storybook 8.6.0 generated: array argument, captured result, forwarded `beforeAll`. */
const SB_8_6_0_SETUP_FILE = dedent`
  import { beforeAll } from 'vitest';
  import { setProjectAnnotations } from '@storybook/react-vite';
  import * as projectAnnotations from './preview';

  // This is an important step to apply the right configuration when testing your stories.
  // More info at: https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest#setprojectannotations
  const project = setProjectAnnotations([projectAnnotations]);

  beforeAll(project.beforeAll);
`;

/** Storybook 8.6.0 wrote an empty array when the project had no preview file. */
const SB_8_6_0_NO_PREVIEW_SETUP_FILE = dedent`
  import { beforeAll } from 'vitest';
  import { setProjectAnnotations } from '@storybook/react-vite';

  const project = setProjectAnnotations([]);

  beforeAll(project.beforeAll);
`;

/** An 8.6.0 file the user extended: the extra annotations must not be deleted silently. */
const MODIFIED_SB_8_6_0_SETUP_FILE = dedent`
  import { beforeAll } from 'vitest';
  import { setProjectAnnotations } from '@storybook/react-vite';
  import * as projectAnnotations from './preview';
  import { addonAnnotations } from '../addons/a11y-preview';

  const project = setProjectAnnotations([projectAnnotations, addonAnnotations]);

  beforeAll(project.beforeAll);
`;

/** A file carrying user code beyond the generated boilerplate. */
const EXTRA_STATEMENT_SETUP_FILE = dedent`
  import { setProjectAnnotations } from '@storybook/react-vite';
  import * as projectAnnotations from './preview';

  setProjectAnnotations([projectAnnotations]);

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
`;

const ADDON_ANNOTATIONS_SETUP_FILE = dedent`
  import { setProjectAnnotations } from '@storybook/react-vite';
  import * as projectAnnotations from './preview';
  import { addonAnnotations } from '../addons/a11y-preview';

  setProjectAnnotations([projectAnnotations, addonAnnotations]);
`;

const INLINE_OBJECT_SETUP_FILE = dedent`
  import { setProjectAnnotations } from '@storybook/react-vite';

  setProjectAnnotations([{ initialGlobals: { foo: 'bar' } }]);
`;

let fixtureRoot: string;

function createFixture(files: Record<string, string>) {
  fixtureRoot = mkdtempSync(path.join(tmpdir(), 'storybook-vitest-setup-file-'));
  mkdirSync(path.join(fixtureRoot, 'node_modules'));

  for (const [filePath, content] of Object.entries(files)) {
    const absolutePath = path.join(fixtureRoot, filePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }

  // findFilesUp walks up to the project root; confine it to the fixture
  process.env.STORYBOOK_PROJECT_ROOT = fixtureRoot;

  const packageManager = {
    instanceDir: path.join(fixtureRoot, 'node_modules'),
    isPackageInstalled: async () => true,
  };

  return {
    configDir: path.join(fixtureRoot, '.storybook'),
    setupFilePath: path.join(fixtureRoot, '.storybook', 'vitest.setup.ts'),
    packageManager,
  };
}

afterAll(() => {
  delete process.env.STORYBOOK_PROJECT_ROOT;
  if (fixtureRoot) {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

/**
 * Fixture roots are temporary directories and errors are colorized, so raw output would make
 * snapshots machine-specific. Normalizing both keeps them reviewable as the migration's real
 * output.
 */
function normalize(output: string) {
  return stripVTControlCharacters(output).replaceAll(fixtureRoot, '<fixture>');
}

/** Reads a fixture file and normalizes it for snapshotting. */
function readFixture(filePath: string) {
  return normalize(readFileSync(path.join(fixtureRoot, filePath), 'utf8'));
}

/** Runs the migration and returns the error message it refuses with. */
async function runAndCaptureError(result: unknown) {
  try {
    await vitestSetupFile.run?.({ result, dryRun: false } as any);
  } catch (error) {
    return normalize(String(error instanceof Error ? error.message : error));
  }
  throw new Error('Expected the migration to refuse, but it succeeded');
}

describe('vitestSetupFile', () => {
  describe('check', () => {
    it('returns null when there is no setup file', async () => {
      const { configDir, packageManager } = createFixture({
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });

      expect(
        await vitestSetupFile.check({
          configDir,
          hasCsfFactoryPreview: false,
          packageManager,
        } as any)
      ).toBeNull();
    });

    it('returns null when the setup file does not reference setProjectAnnotations', async () => {
      const { configDir, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': "import { setup } from './other';",
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });

      expect(
        await vitestSetupFile.check({
          configDir,
          hasCsfFactoryPreview: false,
          packageManager,
        } as any)
      ).toBeNull();
    });

    it('returns null for CSF factory previews', async () => {
      const { configDir, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': STANDARD_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });

      expect(
        await vitestSetupFile.check({
          configDir,
          hasCsfFactoryPreview: true,
          packageManager,
        } as any)
      ).toBeNull();
    });

    it('returns null when @storybook/addon-vitest is not installed', async () => {
      const { configDir, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': STANDARD_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });
      packageManager.isPackageInstalled = async () => false;

      expect(
        await vitestSetupFile.check({
          configDir,
          hasCsfFactoryPreview: false,
          packageManager,
        } as any)
      ).toBeNull();
    });

    it('detects the generated setup file in configDir and the config referencing it', async () => {
      const { configDir, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': STANDARD_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);

      expect(result?.setupFiles).toHaveLength(1);
      expect(result?.setupFiles[0]).toMatchObject({ isRewritable: true, reason: null });
      expect(result?.configFiles).toEqual([path.join(fixtureRoot, 'vitest.config.ts')]);
    });

    it('detects setup files outside configDir referenced from the config', async () => {
      const { configDir, packageManager } = createFixture({
        'src/vitest.setup.ts': STANDARD_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG.replace(
          './.storybook/vitest.setup.ts',
          './src/vitest.setup.ts'
        ),
      });

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);

      expect(result?.setupFiles).toHaveLength(1);
      expect(result?.configFiles).toEqual([path.join(fixtureRoot, 'vitest.config.ts')]);
    });

    it('marks unsafe shapes as not rewritable', async () => {
      const { configDir, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': EXTRA_STATEMENT_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);

      expect(result?.setupFiles[0].isRewritable).toBe(false);
      expect(result?.setupFiles[0].reason).toContain('single "setProjectAnnotations" call');
    });
  });

  describe('run', () => {
    it('deletes the setup file and removes its entry from the config', async () => {
      const { configDir, setupFilePath, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': STANDARD_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });
      const configPath = path.join(fixtureRoot, 'vitest.config.ts');

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);
      await vitestSetupFile.run?.({ result: result!, dryRun: false } as any);

      expect(existsSync(setupFilePath)).toBe(false);

      const updatedConfig = readFixture('vitest.config.ts');
      expect(updatedConfig).toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';

        export default defineConfig({
          test: {},
        });"
      `);
      // The rewritten config must still be a valid Vitest config
      loadConfig(updatedConfig, configPath);
    });

    it('keeps unrelated setupFiles entries', async () => {
      const { configDir, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': STANDARD_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG.replace(
          "setupFiles: ['./.storybook/vitest.setup.ts'],",
          "setupFiles: ['./other-setup.ts', './.storybook/vitest.setup.ts'],"
        ),
      });

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);
      await vitestSetupFile.run?.({ result: result!, dryRun: false } as any);

      const updatedConfig = readFixture('vitest.config.ts');
      expect(updatedConfig).toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';

        export default defineConfig({
          test: {
            setupFiles: ['./other-setup.ts'],
          },
        });"
      `);
    });

    it('removes entries from defineWorkspace configs', async () => {
      const { configDir, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': STANDARD_SETUP_FILE,
        'vitest.workspace.ts': WORKSPACE_CONFIG,
      });

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);
      await vitestSetupFile.run?.({ result: result!, dryRun: false } as any);

      const updatedConfig = readFixture('vitest.workspace.ts');
      expect(updatedConfig).toMatchInlineSnapshot(`
        "import { defineWorkspace } from 'vitest/config';

        export default defineWorkspace([
          {
            test: {
              name: 'storybook'
            },
          },
        ]);"
      `);
      loadConfig(updatedConfig, path.join(fixtureRoot, 'vitest.workspace.ts'));
    });

    it('removes entries from nested test.projects configs', async () => {
      const { configDir, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': STANDARD_SETUP_FILE,
        'vitest.config.ts': PROJECTS_CONFIG,
      });

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);
      await vitestSetupFile.run?.({ result: result!, dryRun: false } as any);

      const updatedConfig = readFixture('vitest.config.ts');
      expect(updatedConfig).toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';

        export default defineConfig({
          test: {
            projects: [
              {
                test: {},
              },
            ],
          },
        });"
      `);
      loadConfig(updatedConfig, path.join(fixtureRoot, 'vitest.config.ts'));
    });

    it('drops a string-valued setupFiles entry', async () => {
      const { configDir, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': STANDARD_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG.replace(
          "setupFiles: ['./.storybook/vitest.setup.ts'],",
          "setupFiles: './.storybook/vitest.setup.ts',"
        ),
      });

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);
      await vitestSetupFile.run?.({ result: result!, dryRun: false } as any);

      const updatedConfig = readFixture('vitest.config.ts');
      expect(updatedConfig).toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';

        export default defineConfig({
          test: {},
        });"
      `);
      loadConfig(updatedConfig, path.join(fixtureRoot, 'vitest.config.ts'));
    });

    it('deletes a setup file generated by Storybook 8.6.0', async () => {
      const { configDir, setupFilePath, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': SB_8_6_0_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });
      const configPath = path.join(fixtureRoot, 'vitest.config.ts');

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);

      expect(result?.setupFiles[0].isRewritable).toBe(true);

      await vitestSetupFile.run?.({ result: result!, dryRun: false } as any);

      // The `./preview` import goes away with the file, so nothing is left dangling
      expect(existsSync(setupFilePath)).toBe(false);

      const updatedConfig = readFixture('vitest.config.ts');
      expect(updatedConfig).toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';

        export default defineConfig({
          test: {},
        });"
      `);
      loadConfig(updatedConfig, configPath);
    });

    it('deletes a Storybook 8.6.0 setup file that has no preview import', async () => {
      const { configDir, setupFilePath, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': SB_8_6_0_NO_PREVIEW_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });
      const configPath = path.join(fixtureRoot, 'vitest.config.ts');

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);
      await vitestSetupFile.run?.({ result: result!, dryRun: false } as any);

      expect(existsSync(setupFilePath)).toBe(false);

      const updatedConfig = readFixture('vitest.config.ts');
      expect(updatedConfig).toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';

        export default defineConfig({
          test: {},
        });"
      `);
      loadConfig(updatedConfig, configPath);
    });

    it('resolves a Storybook 8.6.0 setup file referenced via path.join', async () => {
      const { configDir, setupFilePath, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': SB_8_6_0_SETUP_FILE,
        'vitest.config.ts': dedent`
          import path from 'path';
          import { defineConfig } from 'vitest/config';

          export default defineConfig({
            test: {
              setupFiles: [path.join(import.meta.dirname, '.storybook/vitest.setup.ts')],
            },
          });
        `,
      });
      const configPath = path.join(fixtureRoot, 'vitest.config.ts');

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);
      await vitestSetupFile.run?.({ result: result!, dryRun: false } as any);

      expect(existsSync(setupFilePath)).toBe(false);

      const updatedConfig = readFixture('vitest.config.ts');
      expect(updatedConfig).toMatchInlineSnapshot(`
        "import path from 'path';
        import { defineConfig } from 'vitest/config';

        export default defineConfig({
          test: {},
        });"
      `);
      loadConfig(updatedConfig, configPath);
    });

    it('refuses a Storybook 8.6.0 setup file the user extended', async () => {
      const { configDir, setupFilePath, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': MODIFIED_SB_8_6_0_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });
      const originalConfig = readFileSync(path.join(fixtureRoot, 'vitest.config.ts'), 'utf8');

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);

      expect(result?.setupFiles[0].isRewritable).toBe(false);
      expect(await runAndCaptureError(result!)).toMatchInlineSnapshot(`
        "The vitest-setup-file automigration couldn't migrate your Vitest setup file(s) automatically, but here are instructions for doing it yourself:

        1) <fixture>/.storybook/vitest.setup.ts: it imports "../addons/a11y-preview", which is not part of the generated boilerplate

        Since Storybook 10.3, @storybook/addon-vitest applies your project annotations automatically. From Storybook 11.0 it always does, and its setup file runs before yours. Because setProjectAnnotations replaces the project annotations instead of adding to them, a leftover call discards what the addon applied:

        - setProjectAnnotations([projectAnnotations]);

        For each file listed above:
          1. If the setProjectAnnotations call only re-applies your .storybook preview, remove the call — the addon now does this for you.
          2. If you pass extra annotations (e.g. from an addon's preview), move them into your .storybook preview and then remove the call. setProjectAnnotations replaces the annotations set by the addon instead of adding to them, so a leftover call silently drops them.
          3. If nothing else remains in the file, delete it and remove its entry from the setupFiles array in your Vitest config.

        For any setupFiles entry listed above: check where it points. If it resolves to a setup file that only re-applies your preview, delete that file and remove the entry.

        Read more: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-project-annotations-are-always-applied"
      `);

      // Deleting it would drop `addonAnnotations`, so both files must survive
      expect(existsSync(setupFilePath)).toBe(true);
      expect(readFixture('vitest.config.ts')).toBe(normalize(originalConfig));
    });

    it('leaves everything untouched on a dry run', async () => {
      const { configDir, setupFilePath, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': STANDARD_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });
      const originalConfig = readFileSync(path.join(fixtureRoot, 'vitest.config.ts'), 'utf8');

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);
      await vitestSetupFile.run?.({ result: result!, dryRun: true } as any);

      expect(existsSync(setupFilePath)).toBe(true);
      expect(readFixture('vitest.config.ts')).toBe(normalize(originalConfig));
      // Unchanged, and snapshotted so the untouched inputs are reviewable next to the rewrites
      expect(readFixture('vitest.config.ts')).toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';

        export default defineConfig({
          test: {
            setupFiles: ['./.storybook/vitest.setup.ts'],
          },
        });"
      `);
      expect(readFixture('.storybook/vitest.setup.ts')).toMatchInlineSnapshot(`
        "import { setProjectAnnotations } from '@storybook/react-vite';
        import * as projectAnnotations from './preview';

        setProjectAnnotations([projectAnnotations]);"
      `);
    });

    it('throws manual instructions for unsafe shapes and leaves files untouched', async () => {
      const { configDir, setupFilePath, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': EXTRA_STATEMENT_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });
      const originalConfig = readFileSync(path.join(fixtureRoot, 'vitest.config.ts'), 'utf8');

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);

      const error = await runAndCaptureError(result!);
      expect(error).toMatchInlineSnapshot(`
        "The vitest-setup-file automigration couldn't migrate your Vitest setup file(s) automatically, but here are instructions for doing it yourself:

        1) <fixture>/.storybook/vitest.setup.ts: it must contain a single "setProjectAnnotations" call and nothing else

        Since Storybook 10.3, @storybook/addon-vitest applies your project annotations automatically. From Storybook 11.0 it always does, and its setup file runs before yours. Because setProjectAnnotations replaces the project annotations instead of adding to them, a leftover call discards what the addon applied:

        - setProjectAnnotations([projectAnnotations]);

        For each file listed above:
          1. If the setProjectAnnotations call only re-applies your .storybook preview, remove the call — the addon now does this for you.
          2. If you pass extra annotations (e.g. from an addon's preview), move them into your .storybook preview and then remove the call. setProjectAnnotations replaces the annotations set by the addon instead of adding to them, so a leftover call silently drops them.
          3. If nothing else remains in the file, delete it and remove its entry from the setupFiles array in your Vitest config.

        For any setupFiles entry listed above: check where it points. If it resolves to a setup file that only re-applies your preview, delete that file and remove the entry.

        Read more: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-project-annotations-are-always-applied"
      `);

      // The refusal must be inert: the setup file and the config survive untouched
      expect(existsSync(setupFilePath)).toBe(true);
      expect(readFixture('vitest.config.ts')).toBe(normalize(originalConfig));
    });

    it('numbers all unsafe files in the error message', async () => {
      const { configDir, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': EXTRA_STATEMENT_SETUP_FILE,
        'src/other-vitest.setup.ts': INLINE_OBJECT_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG.replace(
          "setupFiles: ['./.storybook/vitest.setup.ts'],",
          "setupFiles: ['./.storybook/vitest.setup.ts', './src/other-vitest.setup.ts'],"
        ),
      });

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);

      expect(await runAndCaptureError(result!)).toMatchInlineSnapshot(`
        "The vitest-setup-file automigration couldn't migrate your Vitest setup file(s) automatically, but here are instructions for doing it yourself:

        1) <fixture>/.storybook/vitest.setup.ts: it must contain a single "setProjectAnnotations" call and nothing else

        2) <fixture>/src/other-vitest.setup.ts: the call passes inline objects or addon annotation modules

        Since Storybook 10.3, @storybook/addon-vitest applies your project annotations automatically. From Storybook 11.0 it always does, and its setup file runs before yours. Because setProjectAnnotations replaces the project annotations instead of adding to them, a leftover call discards what the addon applied:

        - setProjectAnnotations([projectAnnotations]);

        For each file listed above:
          1. If the setProjectAnnotations call only re-applies your .storybook preview, remove the call — the addon now does this for you.
          2. If you pass extra annotations (e.g. from an addon's preview), move them into your .storybook preview and then remove the call. setProjectAnnotations replaces the annotations set by the addon instead of adding to them, so a leftover call silently drops them.
          3. If nothing else remains in the file, delete it and remove its entry from the setupFiles array in your Vitest config.

        For any setupFiles entry listed above: check where it points. If it resolves to a setup file that only re-applies your preview, delete that file and remove the entry.

        Read more: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-project-annotations-are-always-applied"
      `);
    });

    it('explains how to preserve custom annotations the addon would otherwise lose', async () => {
      const { configDir, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': ADDON_ANNOTATIONS_SETUP_FILE,
        'vitest.config.ts': STANDARD_VITEST_CONFIG,
      });

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);

      expect(await runAndCaptureError(result!)).toMatchInlineSnapshot(`
        "The vitest-setup-file automigration couldn't migrate your Vitest setup file(s) automatically, but here are instructions for doing it yourself:

        1) <fixture>/.storybook/vitest.setup.ts: it imports "../addons/a11y-preview", which is not part of the generated boilerplate

        Since Storybook 10.3, @storybook/addon-vitest applies your project annotations automatically. From Storybook 11.0 it always does, and its setup file runs before yours. Because setProjectAnnotations replaces the project annotations instead of adding to them, a leftover call discards what the addon applied:

        - setProjectAnnotations([projectAnnotations]);

        For each file listed above:
          1. If the setProjectAnnotations call only re-applies your .storybook preview, remove the call — the addon now does this for you.
          2. If you pass extra annotations (e.g. from an addon's preview), move them into your .storybook preview and then remove the call. setProjectAnnotations replaces the annotations set by the addon instead of adding to them, so a leftover call silently drops them.
          3. If nothing else remains in the file, delete it and remove its entry from the setupFiles array in your Vitest config.

        For any setupFiles entry listed above: check where it points. If it resolves to a setup file that only re-applies your preview, delete that file and remove the entry.

        Read more: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-project-annotations-are-always-applied"
      `);
    });
    it('resolves path.join(import.meta.dirname, ...) entries like literals', async () => {
      const { configDir, setupFilePath, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': STANDARD_SETUP_FILE,
        'vitest.config.ts': dedent`
          import { defineConfig } from 'vitest/config';
          import path from 'path';

          export default defineConfig({
            test: {
              setupFiles: [path.join(import.meta.dirname, '.storybook/vitest.setup.ts')],
            },
          });
        `,
      });

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);
      await vitestSetupFile.run?.({ result: result!, dryRun: false } as any);

      expect(existsSync(setupFilePath)).toBe(false);

      const updatedConfig = readFixture('vitest.config.ts');
      expect(updatedConfig).toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';
        import path from 'path';

        export default defineConfig({
          test: {},
        });"
      `);
      loadConfig(updatedConfig, path.join(fixtureRoot, 'vitest.config.ts'));
    });

    it('resolves __dirname and template-literal entries', async () => {
      const { configDir, setupFilePath, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': STANDARD_SETUP_FILE,
        'vitest.config.ts': dedent`
          import { defineConfig } from 'vitest/config';
          import path from 'path';

          export default defineConfig({
            test: {
              setupFiles: [
                path.resolve(__dirname, \`./.storybook/vitest.setup.ts\`),
                './other-setup.ts',
              ],
            },
          });
        `,
      });

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);
      await vitestSetupFile.run?.({ result: result!, dryRun: false } as any);

      expect(existsSync(setupFilePath)).toBe(false);

      const updatedConfig = readFixture('vitest.config.ts');
      expect(updatedConfig).toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';
        import path from 'path';

        export default defineConfig({
          test: {
            setupFiles: ['./other-setup.ts'],
          },
        });"
      `);
      loadConfig(updatedConfig, path.join(fixtureRoot, 'vitest.config.ts'));
    });

    it('reports entries it cannot resolve instead of silently skipping them', async () => {
      const { configDir, setupFilePath, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': STANDARD_SETUP_FILE,
        'vitest.config.ts': dedent`
          import { defineConfig } from 'vitest/config';

          const setupFile = process.env.CI ? './ci-setup.ts' : './.storybook/vitest.setup.ts';

          export default defineConfig({
            test: {
              setupFiles: [setupFile],
            },
          });
        `,
      });
      const originalConfig = readFileSync(path.join(fixtureRoot, 'vitest.config.ts'), 'utf8');

      const result = await vitestSetupFile.check({
        configDir,
        hasCsfFactoryPreview: false,
        packageManager,
      } as any);

      expect(await runAndCaptureError(result!)).toMatchInlineSnapshot(`
        "The vitest-setup-file automigration couldn't migrate your Vitest setup file(s) automatically, but here are instructions for doing it yourself:

        1) <fixture>/vitest.config.ts: the setupFiles entry setupFile is computed at runtime, so it can't be matched without executing your config

        Since Storybook 10.3, @storybook/addon-vitest applies your project annotations automatically. From Storybook 11.0 it always does, and its setup file runs before yours. Because setProjectAnnotations replaces the project annotations instead of adding to them, a leftover call discards what the addon applied:

        - setProjectAnnotations([projectAnnotations]);

        For each file listed above:
          1. If the setProjectAnnotations call only re-applies your .storybook preview, remove the call — the addon now does this for you.
          2. If you pass extra annotations (e.g. from an addon's preview), move them into your .storybook preview and then remove the call. setProjectAnnotations replaces the annotations set by the addon instead of adding to them, so a leftover call silently drops them.
          3. If nothing else remains in the file, delete it and remove its entry from the setupFiles array in your Vitest config.

        For any setupFiles entry listed above: check where it points. If it resolves to a setup file that only re-applies your preview, delete that file and remove the entry.

        Read more: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-project-annotations-are-always-applied"
      `);

      // The refusal must be inert: a dynamic entry could be the reference to this very file
      expect(existsSync(setupFilePath)).toBe(true);
      expect(readFixture('vitest.config.ts')).toBe(normalize(originalConfig));
    });
  });
});
