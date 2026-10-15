import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it } from 'vitest';

import { SVELTE_CSF_IMPORT_SOURCES } from '../constants.ts';
import { parseForIndexer } from './parser.ts';

async function writeStoriesFile(content: string) {
  const file = join(await mkdtemp(join(tmpdir(), 'svelte-csf-')), 'Example.stories.svelte');
  await writeFile(file, content);
  return file;
}

describe('parseForIndexer', () => {
  it('indexes a file with SCSS styles that Svelte cannot parse', async ({ expect }) => {
    const file = await writeStoriesFile(`<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';
  const { Story } = defineMeta({ title: 'Example' });
</script>

<Story name="Default" />

<style lang="scss">
  $primary: #ff4785;
  // a line comment
  %placeholder { color: $primary; }
  .button-#{$primary} { @extend %placeholder; }
</style>
`);

    const { stories } = await parseForIndexer(file);

    expect(stories.map((story) => story.exportName)).toEqual(['Default']);
  });

  it('keeps stories after a script that mentions a style tag', async ({ expect }) => {
    const file = await writeStoriesFile(`<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';
  const { Story } = defineMeta({ title: 'Example' });
  const markup = '<style>';
</script>

<!-- <style> -->
<Story name="Default" />

<style>
  .a { color: red; }
</style>
`);

    const { stories } = await parseForIndexer(file);

    expect(stories.map((story) => story.exportName)).toEqual(['Default']);
  });

  const module = `<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';
  const { Story } = defineMeta({ title: 'Example' });
</script>`;
  const scss = `<style lang="scss">
  $primary: #ff4785;
</style>`;

  it.for([
    [
      'a template expression with "<style>"',
      `${module}\n<p>{'<style>'}</p>\n<Story name="Default" />\n<style>.a { color: red; }</style>`,
    ],
    [
      '"</style>" in a CSS string',
      `${module}\n<Story name="Default" />\n<style>.a::after { content: "</style>"; }</style>`,
    ],
    [
      'a custom element named style-*',
      `${module}\n<style-guide></style-guide>\n<Story name="Default" />\n${scss}`,
    ],
    [
      'a style block closed with "</style >"',
      `${module}\n<Story name="Default" />\n${scss.replace('</style>', '</style >')}`,
    ],
    [
      'a script closed with "</script >"',
      `${module.replace('</script>', "  const markup = '<style>';\n</script >")}\n<Story name="Default" />\n${scss}`,
    ],
  ])('indexes a file with %s', async ([, content], { expect }) => {
    const { stories } = await parseForIndexer(await writeStoriesFile(content));

    expect(stories.map((story) => story.exportName)).toEqual(['Default']);
  });

  it('reports errors after a style block at their original position', async ({ expect }) => {
    const file = await writeStoriesFile(`<style lang="scss">
  $primary: #ff4785;
</style>

<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';
  const { Story } = defineMeta({ title: 'Example' });
</script>

<Story name="Default" {/>
`);

    await expect(parseForIndexer(file)).rejects.toMatchObject({ start: { line: 10 } });
  });

  describe('imports', () => {
    const writeModuleScript = (moduleScript: string) =>
      writeStoriesFile(`<script module lang="ts">
          ${moduleScript}
        </script>

        <Story name="Default" />
        `);

    it.for(SVELTE_CSF_IMPORT_SOURCES)(
      'indexes a file that imports defineMeta from %s',
      async (source, { expect }) => {
        const file = await writeModuleScript(`
          import { defineMeta } from '${source}';
          const { Story } = defineMeta({ title: 'Example' });
        `);

        const { stories } = await parseForIndexer(file);

        expect(stories.map((story) => story.exportName)).toEqual(['Default']);
      }
    );

    it('indexes a file with type-only, other named and namespace imports', async ({ expect }) => {
      const file = await writeModuleScript(`
        import * as SB from '@storybook/svelte';
        import type { Meta } from '@storybook/svelte';
        import { composeStories, defineMeta } from '@storybook/svelte';
        const { Story } = defineMeta({ title: 'Example' });
      `);

      const { meta, stories } = await parseForIndexer(file);

      expect(meta.title).toBe('Example');
      expect(stories.map((story) => story.exportName)).toEqual(['Default']);
    });

    it('does not throw 0002 when defineMeta is imported by name next to a namespace import', async ({
      expect,
    }) => {
      const file = await writeModuleScript(`
        import * as SB from '@storybook/svelte';
        import { defineMeta } from '@storybook/svelte';
      `);

      await expect(parseForIndexer(file)).resolves.toBeDefined();
    });

    it('fails without a named defineMeta import', async ({ expect }) => {
      const file = await writeModuleScript(`
        import Button from './Button.svelte';
      `);

      await expect(parseForIndexer(file)).rejects.toThrow(
        'SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0003'
      );
    });

    it('fails with only a namespace import', async ({ expect }) => {
      const file = await writeModuleScript(`
        import * as SB from '@storybook/svelte';
        const { Story } = SB.defineMeta({ title: 'Example' });
      `);

      await expect(parseForIndexer(file)).rejects.toThrow(
        'SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0002'
      );
    });
  });
  describe('CSF factories', () => {
    const writeFactoryStoriesFile = (moduleScript: string) =>
      writeStoriesFile(`<script module lang="ts">
          ${moduleScript}
        </script>

        <Story name="Primary" tags={['autodocs']} />

        <Story exportName="Secondary" play={async () => {}} />
        `);

    it.for([
      [
        'preview.meta() from #.storybook/preview',
        `import preview from '#.storybook/preview';
        const { Story } = preview.meta({ title: 'Example', tags: ['meta-tag'] });`,
      ],
      [
        'preview.meta() from a relative path',
        `import preview from '../.storybook/preview';
        const { Story } = preview.meta({ title: 'Example', tags: ['meta-tag'] });`,
      ],
      [
        'a renamed preview import',
        `import config from '../.storybook/preview.ts';
        const { Story } = config.meta({ title: 'Example', tags: ['meta-tag'] });`,
      ],
      [
        'a meta variable',
        `import preview from '#.storybook/preview';
        const meta = preview.meta({ title: 'Example', tags: ['meta-tag'] });
        const { Story } = meta;`,
      ],
      [
        'preview.type<>().meta()',
        `import preview from '#.storybook/preview';
        const { Story } = preview
          .type<{ args: { theme: string } }>()
          .meta({ title: 'Example', tags: ['meta-tag'] });`,
      ],
    ])('indexes %s', async ([, moduleScript], { expect }) => {
      const file = await writeFactoryStoriesFile(moduleScript);

      expect(await parseForIndexer(file)).toMatchInlineSnapshot(`
        {
          "meta": {
            "tags": [
              "meta-tag",
            ],
            "title": "Example",
          },
          "stories": [
            {
              "exportName": "Primary",
              "name": "Primary",
              "tags": [
                "autodocs",
              ],
            },
            {
              "exportName": "Secondary",
              "name": undefined,
              "tags": [
                "play-fn",
              ],
            },
          ],
        }
      `);
    });

    it('indexes the stories of the Story components from meta.type<>()', async ({ expect }) => {
      const file = await writeStoriesFile(`<script module lang="ts">
          import preview from '#.storybook/preview';
          const meta = preview.meta({ title: 'Example', tags: ['meta-tag'] });
          const { Story } = meta;
          const { Story: IconStory } = meta.type<{ args: { icon: string } }>();
        </script>

        <Story name="Primary" tags={['autodocs']} />

        <IconStory name="Icon" args={{ icon: 'star' }} tags={['icon-tag']} />
      `);

      expect(await parseForIndexer(file)).toMatchInlineSnapshot(`
        {
          "meta": {
            "tags": [
              "meta-tag",
            ],
            "title": "Example",
          },
          "stories": [
            {
              "exportName": "Primary",
              "name": "Primary",
              "tags": [
                "autodocs",
              ],
            },
            {
              "exportName": "Icon",
              "name": "Icon",
              "tags": [
                "icon-tag",
              ],
            },
          ],
        }
      `);
    });

    it('indexes the Story components declared together with Story', async ({ expect }) => {
      const file = await writeStoriesFile(`<script module lang="ts">
          import preview from '#.storybook/preview';
          const meta = preview.meta({ title: 'Example' });
          const { Story } = meta,
            { Story: IconStory } = meta.type<{ args: { icon: string } }>();
        </script>

        <Story name="Primary" />

        <IconStory name="Icon" args={{ icon: 'star' }} />
      `);

      const { stories } = await parseForIndexer(file);

      expect(stories.map((story) => story.exportName)).toEqual(['Primary', 'Icon']);
    });

    it('fails when a file calls defineMeta() and preview.meta()', async ({ expect }) => {
      const file = await writeFactoryStoriesFile(`
        import { defineMeta } from '@storybook/svelte';
        import preview from '#.storybook/preview';
        const { Story } = defineMeta({});
        const { Story: FactoryStory } = preview.meta({});
      `);

      await expect(parseForIndexer(file)).rejects.toThrow(
        'SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0010'
      );
    });

    it('fails when a file calls preview.meta() twice', async ({ expect }) => {
      const file = await writeFactoryStoriesFile(`
        import preview from '#.storybook/preview';
        const { Story: OtherStory } = preview.meta({});
        const { Story } = preview.meta({});
      `);

      await expect(parseForIndexer(file)).rejects.toThrow(
        'SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0012'
      );
    });

    it('fails when preview is not imported from a preview file', async ({ expect }) => {
      const file = await writeFactoryStoriesFile(`
        import preview from '../storybook-config';
        const { Story } = preview.meta({});
      `);

      await expect(parseForIndexer(file)).rejects.toThrow(
        'SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0011'
      );
    });
  });
});
