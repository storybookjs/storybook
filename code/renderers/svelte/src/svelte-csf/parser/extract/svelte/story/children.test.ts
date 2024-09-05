import { describe, it } from 'vitest';

import { extractStoryChildrenSnippetBlock } from './children';

import { getSvelteAST } from '#parser/ast';
import { extractSvelteASTNodes } from '#parser/extract/svelte/nodes';

describe(extractStoryChildrenSnippetBlock.name, () => {
  it('returns correctly AST node, when a `<Story>` compponent has a snippet block `children` inside', async ({
    expect,
  }) => {
    const code = `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf";

          import SampleComponent from "./SampleComponent.svelte";

          const { Story } = defineMeta({
            component: SampleComponent,
          });
        </script>

        <Story name="With children">
          {#snippet children(args)}
            <SomeComponent {...args} />
          {/snippet}
        </Story>
      `;

    const ast = getSvelteAST({ code });
    const svelteASTNodes = await extractSvelteASTNodes({ ast });
    const { storyComponents } = svelteASTNodes;
    const component = storyComponents[0].component;

    expect(extractStoryChildrenSnippetBlock(component)).toBeDefined();
    expect(extractStoryChildrenSnippetBlock(component)?.expression.name).toBe('children');
  });

  it('returns undefined, when a `<Story>` compponent is a self-closing tag', async ({ expect }) => {
    const code = `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf";

          import SampleComponent from "./SampleComponent.svelte";

          const { Story } = defineMeta({
            component: SampleComponent,
          });
        </script>

        <Story name="Self closing" />
      `;

    const ast = getSvelteAST({ code });
    const svelteASTNodes = await extractSvelteASTNodes({ ast });
    const { storyComponents } = svelteASTNodes;
    const component = storyComponents[0].component;

    expect(extractStoryChildrenSnippetBlock(component)).not.toBeDefined();
  });
});
