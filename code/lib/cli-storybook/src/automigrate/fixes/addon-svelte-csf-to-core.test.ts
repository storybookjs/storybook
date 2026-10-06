import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type JsPackageManager, removeAddon } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { fs, vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { createFixFiles } from '../fix-files.ts';
import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import type { CheckOptions, RunOptions } from '../types.ts';
import {
  type AddonSvelteCsfToCoreResult,
  addonSvelteCsfToCore,
} from './addon-svelte-csf-to-core.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
// The pipeline globs the config directory; real globby, reading the in-memory file system.
vi.mock('globby', async (importOriginal) => {
  const { globby } = await importOriginal<typeof import('globby')>();
  const { fs: memoryFs } = await import('memfs');
  return {
    globby: (patterns: string, options: object) =>
      globby(patterns, { ...options, fs: memoryFs as never }),
  };
});

const MAIN = resolve('/project/.storybook/main.ts');
const DECORATORS = resolve('/project/.storybook/decorators.ts');
const STORY = resolve('/project/src/Button.stories.svelte');
const LEGACY_STORY = resolve('/project/src/Legacy.stories.svelte');
const HELPER = resolve('/project/src/lib/args.ts');
const DOCS = resolve('/project/src/Button.mdx');

const mainConfigFile = (addon: string) => dedent`
  import type { StorybookConfig } from '@storybook/sveltekit';

  const config: StorybookConfig = {
    stories: ['../src/**/*.stories.@(ts|svelte)'],
    addons: ['@storybook/addon-docs', ${addon}],
    framework: '@storybook/sveltekit',
  };
  export default config;
`;

// On Windows, `vol.toJSON()` keys don't match `path.resolve` paths, so the tests track the paths
// they write and read them back through memfs. `vol.fromJSON` also creates the parent directories.
const written = new Set<string>();
const write = (path: string, content: string) => {
  written.add(path);
  vol.fromJSON({ [path]: content });
};
const readWritten = () =>
  Object.fromEntries([...written].map((path) => [path, fs.readFileSync(path, 'utf8')]));

const STORY_FILE = dedent`
  <script module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
  </script>
`;

const LEGACY_STORY_FILE = dedent`
  <script>
    import { Meta, Story } from '@storybook/addon-svelte-csf';
  </script>

  <Meta title="Button" />
`;

describe('addon-svelte-csf-to-core', () => {
  const packageManager = {
    getAllDependencies: vi.fn(),
  } as unknown as JsPackageManager;

  const storyFiles = () =>
    [...written].filter((path) => path.includes('.stories.') || path.endsWith('.mdx'));

  const mainConfig = { framework: '@storybook/sveltekit', addons: ['@storybook/addon-svelte-csf'] };

  const check = (config: Partial<StorybookConfigRaw> = mainConfig, storybookVersion = '11.0.0') =>
    checkFix(addonSvelteCsfToCore, {
      packageManager,
      mainConfig: config,
      storybookVersion,
      storiesPaths: storyFiles(),
      configDir: resolve('/project/.storybook'),
      mainConfigPath: MAIN,
      files: createFixFiles().files,
    } as unknown as CheckOptions);

  const migrate = async (config: Partial<StorybookConfigRaw> = mainConfig) => {
    const result = await check(config);
    await runFix(addonSvelteCsfToCore, {
      result,
      packageManager,
      mainConfigPath: MAIN,
      configDir: resolve('/project/.storybook'),
      storiesPaths: storyFiles(),
      storybookVersion: '11.0.0',
    } as unknown as Omit<RunOptions<AddonSvelteCsfToCoreResult>, 'files'>);
    return readWritten();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();
    written.clear();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vi.mocked(logger.warn).mockImplementation(() => {});
    vi.mocked(removeAddon).mockResolvedValue(undefined);
    vi.mocked(packageManager.getAllDependencies).mockReturnValue({
      '@storybook/addon-svelte-csf': '^5.1.5',
    });
    write(MAIN, mainConfigFile("'@storybook/addon-svelte-csf'"));
    write(STORY, STORY_FILE);
  });

  describe('check', () => {
    it('applies when the addon is in addons as a string', async () => {
      await expect(check()).resolves.toEqual({
        framework: '@storybook/sveltekit',
        mainConfigPath: MAIN,
        importFiles: [STORY],
        legacyStoryFiles: [],
        legacyTemplate: false,
      });
    });

    it('applies when the addon is in addons as an object', async () => {
      const result = await check({
        framework: { name: '@storybook/svelte-vite', options: {} },
        addons: [{ name: '@storybook/addon-svelte-csf', options: {} }],
      });

      expect(result?.framework).toBe('@storybook/svelte-vite');
    });

    it('applies when the addon is only a dependency, without changing the main config', async () => {
      const result = await check({ framework: '@storybook/sveltekit', addons: [] });

      expect(result).toMatchObject({ mainConfigPath: undefined, importFiles: [STORY] });
      expect(addonSvelteCsfToCore.prompt(result!)).not.toContain(MAIN);
    });

    it('reports the legacyTemplate option', async () => {
      const result = await check({
        framework: '@storybook/sveltekit',
        addons: [{ name: '@storybook/addon-svelte-csf', options: { legacyTemplate: true } }],
      });

      expect(result?.legacyTemplate).toBe(true);
    });

    it('reports Svelte CSF stories without defineMeta as legacy stories', async () => {
      write(LEGACY_STORY, LEGACY_STORY_FILE);

      const result = await check();

      expect(result?.legacyStoryFiles).toEqual([LEGACY_STORY]);
      expect(result?.importFiles).toEqual([STORY]);
    });

    it('returns null when the project does not use the addon', async () => {
      vi.mocked(packageManager.getAllDependencies).mockReturnValue({});

      await expect(check({ framework: '@storybook/sveltekit', addons: [] })).resolves.toBeNull();
    });

    it('returns null for frameworks without Svelte CSF', async () => {
      await expect(
        check({ ...mainConfig, framework: '@storybook/react-vite' })
      ).resolves.toBeNull();
    });

    it('returns null before Storybook 11', async () => {
      await expect(check(mainConfig, '10.4.0')).resolves.toBeNull();
    });
  });

  describe('prompt', () => {
    it('lists the files that change and the legacy stories', async () => {
      write(LEGACY_STORY, LEGACY_STORY_FILE);

      const prompt = addonSvelteCsfToCore.prompt((await check())!);

      expect(prompt).toContain(`besides package.json:\n- ${MAIN}\n- ${STORY}`);
      expect(prompt).toContain(`by hand:\n- ${LEGACY_STORY}`);
    });

    it('lists the main config once when it also imports the addon', async () => {
      write(
        MAIN,
        "import type { Args } from '@storybook/addon-svelte-csf';\n" +
          mainConfigFile("'@storybook/addon-svelte-csf'")
      );

      const prompt = addonSvelteCsfToCore.prompt((await check())!);

      expect(prompt.split(`- ${MAIN}`)).toHaveLength(2);
    });
  });

  describe('run', () => {
    it('rewrites a dynamic import with a template literal', async () => {
      write(DECORATORS, 'const csf = await import(`@storybook/addon-svelte-csf`);');

      const files = await migrate();

      expect(files[DECORATORS]).toBe('const csf = await import(`@storybook/sveltekit`);');
    });

    it('leaves strings, comments and markup that name the addon unchanged', async () => {
      write(
        DECORATORS,
        dedent`
          // Moved away from '@storybook/addon-svelte-csf'
          export const snippet = "import { defineMeta } from '@storybook/addon-svelte-csf'";
          import type { Args } from '@storybook/addon-svelte-csf';
        `
      );
      write(
        STORY,
        dedent`
          <script module>
            import { defineMeta } from '@storybook/addon-svelte-csf';
          </script>

          <code>import {'{'} defineMeta {'}'} from '@storybook/addon-svelte-csf'</code>
        `
      );

      const files = await migrate();

      expect(files[DECORATORS]).toMatchInlineSnapshot(`
        "// Moved away from '@storybook/addon-svelte-csf'
        export const snippet = "import { defineMeta } from '@storybook/addon-svelte-csf'";
        import type { Args } from '@storybook/sveltekit';"
      `);
      expect(files[STORY]).toContain(
        "<code>import {'{'} defineMeta {'}'} from '@storybook/addon-svelte-csf'</code>"
      );
      expect(files[STORY]).toContain("import { defineMeta } from '@storybook/sveltekit';");
    });

    it('merges imports in files with CRLF line endings', async () => {
      write(
        STORY,
        "<script module>\r\n  import { defineMeta } from '@storybook/addon-svelte-csf';\r\n  import { type StoryObj } from '@storybook/sveltekit';\r\n</script>\r\n"
      );

      const files = await migrate();

      expect(files[STORY]).toBe(
        "<script module>\r\n  import { defineMeta, type StoryObj } from '@storybook/sveltekit';\r\n</script>\r\n"
      );
    });

    it('treats a story as legacy when defineMeta is only in a comment, a string or markup', async () => {
      const legacyStory = dedent`
        <script>
          import { Meta } from '@storybook/addon-svelte-csf';
          // TODO: migrate to defineMeta
          const note = 'use defineMeta';
        </script>

        <Meta title="Legacy" />
        <p>Use defineMeta instead.</p>
      `;
      write(LEGACY_STORY, legacyStory);

      const files = await migrate();

      expect(files[LEGACY_STORY]).toBe(legacyStory);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`- ${LEGACY_STORY}`));
    });

    it('removes the addon with removeAddon', async () => {
      await migrate();

      expect(removeAddon).toHaveBeenCalledWith('@storybook/addon-svelte-csf', {
        packageManager,
        configDir: resolve('/project/.storybook'),
        skipInstall: true,
      });
    });
    it('rewrites the imports in files of the config directory', async () => {
      write(DECORATORS, "import type { StoryContext } from '@storybook/addon-svelte-csf';");

      const files = await migrate();

      expect(files[DECORATORS]).toBe("import type { StoryContext } from '@storybook/sveltekit';");
    });

    it.each([
      ['@storybook/svelte-vite', '@storybook/svelte-vite'],
      ['@storybook/svelte-vite', { name: '@storybook/svelte-vite', options: {} }],
      ['@storybook/svelte-vite', '/project/node_modules/@storybook/svelte-vite'],
      ['@storybook/sveltekit', '@storybook/sveltekit'],
      ['@storybook/sveltekit', { name: '@storybook/sveltekit', options: {} }],
      ['@storybook/sveltekit', '/project/node_modules/@storybook/sveltekit'],
    ] as const)(
      'rewrites the imports to %s when the framework is %j',
      async (expected, framework) => {
        const files = await migrate({ framework, addons: ['@storybook/addon-svelte-csf'] });

        expect(files[STORY]).toContain(`import { defineMeta } from '${expected}';`);
      }
    );

    it('rewrites the imports in stories and MDX', async () => {
      write(DOCS, "import { defineMeta } from '@storybook/addon-svelte-csf';\n\n# Docs");

      const files = await migrate();

      expect(files[STORY]).toMatchInlineSnapshot(`
        "<script module>
          import { defineMeta } from '@storybook/sveltekit';
        </script>"
      `);
      expect(files[DOCS]).toMatchInlineSnapshot(`
        "import { defineMeta } from '@storybook/sveltekit';

        # Docs"
      `);
    });

    it('leaves files outside the stories and the config directory unchanged', async () => {
      write(HELPER, "import type { Args } from '@storybook/addon-svelte-csf';");

      const files = await migrate();

      expect(files[HELPER]).toBe("import type { Args } from '@storybook/addon-svelte-csf';");
    });

    it('keeps aliases and type imports', async () => {
      write(
        STORY,
        dedent`
          <script module lang="ts">
            import { defineMeta as dm, type Args } from '@storybook/addon-svelte-csf';
            import type { StoryContext } from "@storybook/addon-svelte-csf";
          </script>
        `
      );

      const files = await migrate();

      expect(files[STORY]).toMatchInlineSnapshot(`
        "<script module lang="ts">
          import { defineMeta as dm, type Args } from '@storybook/sveltekit';
          import type { StoryContext } from "@storybook/sveltekit";
        </script>"
      `);
    });

    it('merges the import into an existing import from the framework package', async () => {
      write(
        STORY,
        dedent`
          <script module lang="ts" generics="T extends Record<string, unknown>">
            import { defineMeta } from '@storybook/addon-svelte-csf';
            import { type StoryObj } from '@storybook/sveltekit';
            import type { Args } from '@storybook/addon-svelte-csf';
            import type { Meta } from '@storybook/sveltekit';
          </script>
        `
      );

      const files = await migrate();

      expect(files[STORY]).toMatchInlineSnapshot(`
        "<script module lang="ts" generics="T extends Record<string, unknown>">
          import { defineMeta, type StoryObj } from '@storybook/sveltekit';
          import type { Args, Meta } from '@storybook/sveltekit';
        </script>"
      `);
    });

    it('leaves legacy stories and non-import strings unchanged', async () => {
      write(LEGACY_STORY, LEGACY_STORY_FILE);
      write(DECORATORS, "export const addons = ['@storybook/addon-svelte-csf'];");

      const files = await migrate();

      expect(files[LEGACY_STORY]).toBe(LEGACY_STORY_FILE);
      expect(files[DECORATORS]).toBe("export const addons = ['@storybook/addon-svelte-csf'];");
    });

    it('warns about the legacy syntax when legacyTemplate is set', async () => {
      await migrate({
        framework: '@storybook/sveltekit',
        addons: [{ name: '@storybook/addon-svelte-csf', options: { legacyTemplate: true } }],
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('removes the legacy Svelte CSF syntax')
      );
    });

    it('lists the legacy stories in the warning', async () => {
      write(LEGACY_STORY, LEGACY_STORY_FILE);

      await migrate();

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`- ${LEGACY_STORY}`));
    });

    it('does not warn without legacy stories', async () => {
      await migrate();

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
