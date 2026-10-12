// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { buildSvelteCsfStoryDocs } from './build-story-docs.ts';
import { generateCodeToEmit } from '../../svelte-csf/runtime/emit-code.ts';

const source = dedent`
  <script module>
    import { defineMeta } from '@storybook/svelte';
    import Button from './Button.svelte';

    const { Story } = defineMeta({ component: Button });
  </script>

  {#snippet template(args)}
    <Button {...args}>{args.label}</Button>
  {/snippet}

  <Story name="Primary" args={{ primary: true, label: 'Click' }} {template} />

  <Story name="Children">
    <Button size="large">Hi</Button>
  </Story>

  <Story name="Default" />
`;

describe('buildSvelteCsfStoryDocs', () => {
  it('returns each story template as authored, with its static args', async () => {
    const stories = await buildSvelteCsfStoryDocs(source, 'Button.stories.svelte');
    expect(stories).toMatchInlineSnapshot(`
      [
        {
          "args": {
            "label": "Click",
            "primary": true,
          },
          "exportName": "Primary",
          "name": "Primary",
          "template": "<Button {...args}>{args.label}</Button>",
        },
        {
          "args": {},
          "exportName": "Children",
          "name": "Children",
          "template": "<Button {...args}>
        <Button size="large">Hi</Button>
      </Button>",
        },
        {
          "args": {},
          "exportName": "Default",
          "name": "Default",
          "template": "<Button {...args} />",
        },
      ]
    `);
    const primary = stories[0];
    expect(
      generateCodeToEmit({ code: primary.template, args: primary.args })
    ).toMatchInlineSnapshot(`"<Button primary label="Click">Click</Button>"`);
  });
});
