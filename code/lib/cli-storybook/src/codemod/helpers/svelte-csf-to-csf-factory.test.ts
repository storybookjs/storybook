import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { svelteCsfToCsfFactory } from './svelte-csf-to-csf-factory.ts';

// The Svelte renderer type-checks the files written there with `svelte-check`
const TYPE_FIXTURES_DIR = join(
  import.meta.dirname,
  '../../../../../renderers/svelte/src/__test__/svelte-csf-factories/codemod'
);

const transform = (source: string, path = '/project/src/stories/Button.stories.svelte') =>
  svelteCsfToCsfFactory({ source, path }, { useSubPathImports: true });

const transformRelative = (source: string, path = '/project/src/stories/Button.stories.svelte') =>
  svelteCsfToCsfFactory(
    { source, path },
    { useSubPathImports: false, previewConfigPath: '/project/.storybook/preview.ts' }
  );

const transformTypeFixture = (source: string, name: string) =>
  svelteCsfToCsfFactory(
    { source: `${source}\n`, path: join(TYPE_FIXTURES_DIR, name) },
    { useSubPathImports: false, previewConfigPath: join(TYPE_FIXTURES_DIR, '../preview.ts') }
  );

describe('svelteCsfToCsfFactory', () => {
  it('changes defineMeta() to preview.meta() with a subpath import', () => {
    expect(
      transform(dedent`
        <script module>
          import { defineMeta } from '@storybook/svelte';
          import Button from './Button.svelte';

          const { Story } = defineMeta({ component: Button });
        </script>

        <Story name="Primary" args={{ label: 'Button' }} />
      `)
    ).toMatchInlineSnapshot(`
      "<script module>
        import preview from '#.storybook/preview';
        import Button from './Button.svelte';

        const { Story } = preview.meta({ component: Button });
      </script>

      <Story name="Primary" args={{ label: 'Button' }} />"
    `);
  });

  it('imports the preview with a relative path', () => {
    expect(
      transformRelative(dedent`
        <script module>
          import { defineMeta } from "@storybook/svelte-vite"
          const { Story } = defineMeta({})
        </script>
      `)
    ).toMatchInlineSnapshot(`
      "<script module>
        import preview from "../../.storybook/preview"
        const { Story } = preview.meta({})
      </script>"
    `);
  });

  it('keeps the other imports from the Svelte CSF module', () => {
    expect(
      transform(dedent`
        <script module lang="ts">
          import { type Args, defineMeta } from '@storybook/sveltekit';
          const { Story } = defineMeta({});
        </script>
      `)
    ).toMatchInlineSnapshot(`
      "<script module lang="ts">
        import { type Args } from '@storybook/sveltekit';
        import preview from '#.storybook/preview';
        const { Story } = preview.meta({});
      </script>"
    `);
  });

  it('finds defineMeta after a type import from the same module', () => {
    expect(
      transform(dedent`
        <script module lang="ts">
          import type { Args } from '@storybook/svelte';
          import { defineMeta } from '@storybook/svelte';
          const { Story } = defineMeta({});
        </script>
      `)
    ).toMatchInlineSnapshot(`
      "<script module lang="ts">
        import type { Args } from '@storybook/svelte';
        import preview from '#.storybook/preview';
        const { Story } = preview.meta({});
      </script>"
    `);
  });

  it('reads the annotations of stories from other stories files from their input', () => {
    expect(
      transform(dedent`
        <script module>
          import { defineMeta } from '@storybook/svelte';
          import * as HeaderStories from './Header.stories.svelte';
          import { Unchecked } from './ListItem.stories.svelte';

          const { Story } = defineMeta({ args: { items: [Unchecked.args] } });
        </script>

        <Story name="LoggedIn" args={{ ...HeaderStories.LoggedIn.args }} />

        <Story name="Checked" args={{ ...Unchecked.args, checked: true }} play={Unchecked.play} />
      `)
    ).toMatchInlineSnapshot(`
      "<script module>
        import preview from '#.storybook/preview';
        import * as HeaderStories from './Header.stories.svelte';
        import { Unchecked } from './ListItem.stories.svelte';

        const { Story } = preview.meta({ args: { items: [Unchecked.input.args] } });
      </script>

      <Story name="LoggedIn" args={{ ...HeaderStories.LoggedIn.input.args }} />

      <Story name="Checked" args={{ ...Unchecked.input.args, checked: true }} play={Unchecked.play} />"
    `);
  });

  it('keeps the exports of an imported Svelte CSF file that are not stories', () => {
    const dir = mkdtempSync(join(tmpdir(), 'svelte-csf-'));
    writeFileSync(
      join(dir, 'Task.stories.svelte'),
      dedent`
        <script module>
          import { defineMeta } from '@storybook/svelte';
          export const TaskData = { task: { id: '1' }, events: {} };
          const { Story } = defineMeta({});
        </script>

        <Story name="Default" />
      `
    );

    expect(
      transform(
        dedent`
          <script module>
            import { defineMeta } from '@storybook/svelte';
            import * as TaskStories from './Task.stories.svelte';
            import { TaskData } from './Task.stories.svelte';

            const { Story } = defineMeta({ args: { ...TaskStories.TaskData.events } });
          </script>

          <Story name="Default" args={{ ...TaskStories.Default.args, events: TaskData.events }} />
        `,
        join(dir, 'TaskList.stories.svelte')
      )
    ).toMatchInlineSnapshot(`
      "<script module>
        import preview from '#.storybook/preview';
        import * as TaskStories from './Task.stories.svelte';
        import { TaskData } from './Task.stories.svelte';

        const { Story } = preview.meta({ args: { ...TaskStories.TaskData.events } });
      </script>

      <Story name="Default" args={{ ...TaskStories.Default.input.args, events: TaskData.events }} />"
    `);
  });

  it('reads the story imports of every module script', () => {
    expect(
      transform(dedent`
        <!--
        <script module>
          import { defineMeta } from '@storybook/svelte';
          const { Story } = defineMeta({});
        </script>
        -->
        <script module>
          import { defineMeta } from '@storybook/svelte';
          import { Primary } from './Button.stories.svelte';
          const { Story } = defineMeta({ args: Primary.args });
        </script>
      `)
    ).toMatchInlineSnapshot(`
      "<!--
      <script module>
        import preview from '#.storybook/preview';
        const { Story } = preview.meta({});
      </script>
      -->
      <script module>
        import preview from '#.storybook/preview';
        import { Primary } from './Button.stories.svelte';
        const { Story } = preview.meta({ args: Primary.input.args });
      </script>"
    `);
  });

  it('names the import storybookPreview when the file declares preview', () => {
    expect(
      transform(dedent`
        <script module>
          import { defineMeta } from '@storybook/svelte';
          import preview from './preview-image.png';
          const { Story } = defineMeta({ parameters: { preview } });
        </script>
      `)
    ).toMatchInlineSnapshot(`
      "<script module>
        import storybookPreview from '#.storybook/preview';
        import preview from './preview-image.png';
        const { Story } = storybookPreview.meta({ parameters: { preview } });
      </script>"
    `);
  });

  it('changes a <script context="module"> block', () => {
    expect(
      transform(dedent`
        <script context="module">
          import { defineMeta } from '@storybook/svelte';
          const { Story } = defineMeta({});
        </script>
      `)
    ).toMatchInlineSnapshot(`
      "<script context="module">
        import preview from '#.storybook/preview';
        const { Story } = preview.meta({});
      </script>"
    `);
  });

  it.for([
    [
      'a file that already calls preview.meta()',
      dedent`
        <script module>
          import preview from '#.storybook/preview';
          const { Story } = preview.meta({});
        </script>
      `,
    ],
    [
      'a defineMeta() call in the instance script',
      dedent`
        <script>
          import { defineMeta } from '@storybook/svelte';
          const { Story } = defineMeta({});
        </script>
      `,
    ],
    [
      'a defineMeta() import from another module',
      dedent`
        <script module>
          import { defineMeta } from './my-meta';
          const { Story } = defineMeta({});
        </script>
      `,
    ],
  ])('does not change %s', ([, source]) => {
    expect(transform(source)).toBe(source);
  });

  describe('writes code that type-checks', () => {
    it('for a meta with a component', async () => {
      await expect(
        transformTypeFixture(
          dedent`
            <script module lang="ts">
              import { defineMeta } from '@storybook/svelte';
              import { fn } from 'storybook/test';

              import Button from '../../Button.svelte';

              const { Story } = defineMeta({
                component: Button,
                args: { clicked: fn() },
              });
            </script>

            <Story name="Primary" args={{ label: 'Button', disabled: false }} />

            <Story name="Template" args={{ label: 'Button', disabled: true }}>
              {#snippet template(args)}
                <Button {...args} />
              {/snippet}
            </Story>
          `,
          'component.svelte'
        )
      ).toMatchFileSnapshot(join(TYPE_FIXTURES_DIR, 'component.svelte'));
    });

    it('for a renamed defineMeta and Story', async () => {
      await expect(
        transformTypeFixture(
          dedent`
            <script module lang="ts">
              import { defineMeta as d } from '@storybook/svelte';

              const { Story: S } = d({ parameters: { controls: { disable: true } } });
            </script>

            <S name="Default">
              <p>Static content</p>
            </S>
          `,
          'renamed.svelte'
        )
      ).toMatchFileSnapshot(join(TYPE_FIXTURES_DIR, 'renamed.svelte'));
    });

    it('for a meta with a render snippet', async () => {
      await expect(
        transformTypeFixture(
          dedent`
            <script module lang="ts">
              import { defineMeta } from '@storybook/svelte';

              const { Story } = defineMeta({ render: template });
            </script>

            {#snippet template(args: { text: string })}
              <p>{args.text}</p>
            {/snippet}

            <Story name="Text" args={{ text: 'Hello' }} />
          `,
          'render.svelte'
        )
      ).toMatchFileSnapshot(join(TYPE_FIXTURES_DIR, 'render.svelte'));
    });
  });
});
