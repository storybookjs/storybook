import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import type { Comment, Component } from 'svelte/compiler';
import { print } from 'svelte-ast-print';
import { describe, it } from 'vitest';

import { transformComponentMetaToDefineMeta } from './component-meta-to-define-meta';

import { parseAndExtractSvelteNode } from '#tests/extractor';

describe(transformComponentMetaToDefineMeta.name, () => {
  it('works with a simple example', async ({ expect }) => {
    const code = `
      <script context="module">
        import { Meta } from "${pkg.name}";
      </script>

      <Meta title="Atoms/Button" component={Button} />
    `;
    const node = await parseAndExtractSvelteNode<Component>(code, 'Component');

    expect(
      print(
        transformComponentMetaToDefineMeta({
          component: node,
        })
      )
    ).toMatchInlineSnapshot(
      `"const { Story } = defineMeta({ title: "Atoms/Button", component: Button });"`
    );
  });

  it('leading comments are included', async ({ expect }) => {
    const code = `
      <script context="module">
        import { Meta } from "${pkg.name}";
      </script>

			<!-- This is a description for the **Button** component stories. -->
      <Meta title="Atoms/Button" component={Button} />
    `;
    const [comment, component] = await Promise.all([
      parseAndExtractSvelteNode<Comment>(code, 'Comment'),
      parseAndExtractSvelteNode<Component>(code, 'Component'),
    ]);

    expect(
      print(
        transformComponentMetaToDefineMeta({
          component,
          comment,
        })
      )
    ).toMatchInlineSnapshot(
      `"/** This is a description for the **Button** component stories. */ const { Story } = defineMeta({ title: "Atoms/Button", component: Button });"`
    );
  });
});
