import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';

import type { Options } from '../../types/index.ts';

import { StoryIndexGenerator } from '../../core-server/utils/StoryIndexGenerator.ts';
import { resolveSkillInputs } from './inputs.ts';

vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(existsSync).mockImplementation(memfs.existsSync);
  vi.mocked(readFile).mockImplementation(memfs.promises.readFile as typeof readFile);
  vi.spyOn(process, 'cwd').mockReturnValue('/project');
});

function createMockOptions({
  framework = '@storybook/react-vite',
  configDir,
  presets = {},
}: {
  framework?: string | { name: string };
  configDir?: string;
  presets?: Record<string, () => unknown>;
} = {}): Options {
  return {
    configDir,
    presets: {
      apply: vi.fn(async (key: string, defaultValue?: unknown) => {
        if (key === 'framework') {
          return framework;
        }
        return key in presets ? presets[key]() : defaultValue;
      }),
    },
  } as unknown as Options;
}

describe('resolveSkillInputs', () => {
  it('resolves the framework from a string preset', async () => {
    const options = createMockOptions({ framework: '@storybook/vue3-vite' });

    const inputs = await resolveSkillInputs(options);

    expect(inputs.framework).toBe('@storybook/vue3-vite');
  });

  it('resolves the framework from an object preset', async () => {
    const options = createMockOptions({ framework: { name: '@storybook/nextjs' } });

    const inputs = await resolveSkillInputs(options);

    expect(inputs.framework).toBe('@storybook/nextjs');
  });

  it.each([
    ['/repo/node_modules/@storybook/vue3-vite', '@storybook/vue3-vite'],
    ['C:\\repo\\node_modules\\@storybook\\angular-vite', '@storybook/angular-vite'],
    ['/repo/node_modules/.pnpm/@storybook+react-vite@11.0.0', '@storybook/react-vite'],
  ])('normalizes absolute framework preset %s', async (name, framework) => {
    const inputs = await resolveSkillInputs(createMockOptions({ framework: { name } }));
    expect(inputs.framework).toBe(framework);
  });

  it('spreads the resolved tool availability onto the result', async () => {
    const inputs = await resolveSkillInputs(createMockOptions());

    expect(inputs.moduleGraphSupported).toBe(false);
  });

  it('detects CSF Factories from a preview file that imports definePreview', async () => {
    vol.fromNestedJSON({
      '/project/.storybook/preview.tsx': `import { definePreview } from '@storybook/react-vite';\nexport default definePreview({});`,
    });

    const inputs = await resolveSkillInputs(
      createMockOptions({ configDir: '/project/.storybook' })
    );

    expect(inputs).toMatchObject({
      csfFactories: true,
      previewFile: '.storybook/preview.tsx',
      typescript: true,
    });
  });

  it('reads a plain JavaScript preview as CSF 3', async () => {
    vol.fromNestedJSON({
      '/project/.storybook/preview.js': 'export default { parameters: {} };',
    });

    const inputs = await resolveSkillInputs(
      createMockOptions({ configDir: '/project/.storybook' })
    );

    expect(inputs).toMatchObject({
      csfFactories: false,
      previewFile: '.storybook/preview.js',
      typescript: false,
    });
  });

  it('names the preview file after the main config when the project has none', async () => {
    vol.fromNestedJSON({ '/project/.storybook/main.ts': 'export default {};' });

    const inputs = await resolveSkillInputs(
      createMockOptions({ configDir: '/project/.storybook' })
    );

    expect(inputs).toMatchObject({
      csfFactories: false,
      previewFile: '.storybook/preview.ts',
      typescript: true,
    });
  });

  describe('svelteCsf', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const svelteCsf = async (
      framework: string,
      stories: string[],
      files: string[] | Error
    ): Promise<boolean> => {
      const find = vi.spyOn(StoryIndexGenerator, 'findMatchingFiles');
      if (files instanceof Error) {
        find.mockRejectedValue(files);
      } else {
        find.mockResolvedValue(Object.fromEntries(files.map((path) => [path, false])));
      }
      const inputs = await resolveSkillInputs(
        createMockOptions({
          framework,
          configDir: '/project/.storybook',
          presets: { stories: () => stories },
        })
      );
      return inputs.svelteCsf;
    };

    it.each([
      [
        '.svelte story files',
        ['../src/**/*.stories.@(ts|svelte)'],
        ['/project/src/A.stories.svelte', '/project/src/B.stories.ts'],
        true,
      ],
      [
        'only .ts story files',
        ['../src/**/*.stories.@(ts|svelte)'],
        ['/project/src/B.stories.ts'],
        false,
      ],
      ['no stories yet, entries that load .svelte', ['../src/**/*.stories.svelte'], [], true],
      [
        'only docs pages, entries that load .svelte',
        ['../src/**/*.mdx', '../src/**/*.stories.svelte'],
        ['/project/src/Configure.mdx'],
        true,
      ],
      ['no stories yet, entries that load only .ts', ['../src/**/*.stories.ts'], [], false],
      [
        'an unreadable folder, entries that load .svelte',
        ['../src/**/*.stories.svelte'],
        new Error('EACCES'),
        true,
      ],
      ['no stories yet, a wildcard folder', ['../packages/*/src/**/*.stories.svelte'], [], true],
      ['no stories yet, braces with folders', ['../{src,lib}/**/*.stories.svelte'], [], true],
      ['no stories yet, a fixed subfolder', ['../src/**/stories/*.stories.svelte'], [], true],
      ['no stories yet, a .story.svelte name', ['../src/**/*.story.svelte'], [], true],
      ['no stories yet, a wildcard extension', ['../src/**/stories/*.stories.*'], [], true],
      ['no stories yet, an extglob', ['../src/**/*.stories.@(js|ts|svelte)'], [], true],
      ['no stories yet, an exact file', ['../src/Button.stories.svelte'], [], true],
      [
        'no stories yet, no .svelte extension',
        ['../packages/*/src/**/*.stories.@(ts|tsx)'],
        [],
        false,
      ],
      ['no stories yet, a negated .svelte', ['../src/**/*.stories.!(svelte)'], [], false],
      ['no stories yet, a negated extglob', ['../src/**/*.story.!(ts|tsx)'], [], true],
      ['no stories yet, a nested extglob', ['../src/**/*.@(mdx|story.@(ts|svelte))'], [], true],
      ['no stories yet, a character class', ['../src/**/stories/[A-Z]*.stories.svelte'], [], true],
      [
        'no stories yet, a negated character class',
        ['../src/**/stories/[^_]*.stories.svelte'],
        [],
        true,
      ],
      ['no stories entries', [], [], false],
    ])('a Svelte project with %s: %s', async (_, stories, files, expected) => {
      expect(await svelteCsf('@storybook/sveltekit', stories, files)).toBe(expected);
    });

    it('is false for a framework that does not render Svelte', async () => {
      expect(
        await svelteCsf(
          '@storybook/react-vite',
          ['../src/**/*.stories.svelte'],
          ['/project/src/A.stories.svelte']
        )
      ).toBe(false);
    });
  });
  it('marks a project that composes other Storybooks', async () => {
    const composed = await resolveSkillInputs(
      createMockOptions({
        presets: { refs: () => ({ design: { url: 'https://design.example' } }) },
      })
    );
    expect(composed.composed).toBe(true);

    const single = await resolveSkillInputs(createMockOptions());
    expect(single.composed).toBe(false);
  });
});
