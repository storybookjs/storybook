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

const CAPTURED_RETURN_VALUE_SETUP_FILE = dedent`
  import { setProjectAnnotations } from '@storybook/react-vite';
  import * as projectAnnotations from './preview';

  const project = setProjectAnnotations([projectAnnotations]);

  beforeAll(project.beforeAll);
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
        '.storybook/vitest.setup.ts': CAPTURED_RETURN_VALUE_SETUP_FILE,
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
        '.storybook/vitest.setup.ts': CAPTURED_RETURN_VALUE_SETUP_FILE,
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

        Since Storybook 10.3, @storybook/addon-vitest applies your project annotations automatically. From Storybook 11.0 it always does, so your setup file runs in addition to that. Calls to setProjectAnnotations compose additively, so nothing breaks, but the boilerplate is redundant:

        - setProjectAnnotations([projectAnnotations]);

        For each file listed above:
          1. If the setProjectAnnotations call only re-applies your .storybook preview, remove the call — the addon now does this for you.
          2. If you pass extra annotations (e.g. from an addon's preview), keep them: they compose with the automatic ones.
          3. If nothing else remains in the file, delete it and remove its entry from the setupFiles array in your Vitest config.

        Read more: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-project-annotations-are-always-applied"
      `);

      // The refusal must be inert: the setup file and the config survive untouched
      expect(existsSync(setupFilePath)).toBe(true);
      expect(readFixture('vitest.config.ts')).toBe(normalize(originalConfig));
    });

    it('numbers all unsafe files in the error message', async () => {
      const { configDir, packageManager } = createFixture({
        '.storybook/vitest.setup.ts': CAPTURED_RETURN_VALUE_SETUP_FILE,
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

        Since Storybook 10.3, @storybook/addon-vitest applies your project annotations automatically. From Storybook 11.0 it always does, so your setup file runs in addition to that. Calls to setProjectAnnotations compose additively, so nothing breaks, but the boilerplate is redundant:

        - setProjectAnnotations([projectAnnotations]);

        For each file listed above:
          1. If the setProjectAnnotations call only re-applies your .storybook preview, remove the call — the addon now does this for you.
          2. If you pass extra annotations (e.g. from an addon's preview), keep them: they compose with the automatic ones.
          3. If nothing else remains in the file, delete it and remove its entry from the setupFiles array in your Vitest config.

        Read more: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-project-annotations-are-always-applied"
      `);
    });

    it('explains that custom annotations compose with the automatic ones', async () => {
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

        Since Storybook 10.3, @storybook/addon-vitest applies your project annotations automatically. From Storybook 11.0 it always does, so your setup file runs in addition to that. Calls to setProjectAnnotations compose additively, so nothing breaks, but the boilerplate is redundant:

        - setProjectAnnotations([projectAnnotations]);

        For each file listed above:
          1. If the setProjectAnnotations call only re-applies your .storybook preview, remove the call — the addon now does this for you.
          2. If you pass extra annotations (e.g. from an addon's preview), keep them: they compose with the automatic ones.
          3. If nothing else remains in the file, delete it and remove its entry from the setupFiles array in your Vitest config.

        Read more: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-project-annotations-are-always-applied"
      `);
    });
  });
});
