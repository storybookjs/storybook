import { describe, expect, it } from 'vitest';

import { extractFragmentNodes } from './fragment-nodes';
import { extractInstanceNodes } from './instance-nodes';
import { extractModuleNodes } from './module-nodes';

import { getSvelteAST } from '#parser/ast';

describe(extractFragmentNodes.name, () => {
  it("extracts '<Story />' AST nodes correctly", async () => {
    const ast = getSvelteAST({
      code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story name="1" />
        <Story name="2" />
        <Story name="3" />
        <Story name="4" />
        <Story name="5" />
      `,
    });
    const moduleNodes = await extractModuleNodes({ module: ast.module });
    const instanceNodes = await extractInstanceNodes({
      instance: ast.instance,
      moduleNodes,
    });
    const fragmentNodes = await extractFragmentNodes({
      fragment: ast.fragment,
      instanceNodes,
      moduleNodes,
    });

    expect(fragmentNodes.storyComponents).toHaveLength(5);
    for (const story of fragmentNodes.storyComponents) {
      expect(story.comment).toBeUndefined();
    }
    expect(fragmentNodes.snippetBlocks).toHaveLength(0);
  });

  it("extracts '<Story />' leading HTML comments correctly", async () => {
    const ast = getSvelteAST({
      code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <!-- Comment 1 -->
        <Story name="1" />
        <!-- Comment 2 -->
        <Story name="2" />
        <!-- Comment 3 -->
        <Story name="3" />
        <!-- Comment 4 -->
        <Story name="4" />
        <!-- Comment 5 -->
        <Story name="5" />
      `,
    });
    const moduleNodes = await extractModuleNodes({ module: ast.module });
    const instanceNodes = await extractInstanceNodes({
      instance: ast.instance,
      moduleNodes,
    });
    const fragmentNodes = await extractFragmentNodes({
      fragment: ast.fragment,
      instanceNodes,
      moduleNodes,
    });

    expect(fragmentNodes.storyComponents).toHaveLength(5);
    for (const [index, story] of Object.entries(fragmentNodes.storyComponents)) {
      expect(story.comment?.data).toBe(` Comment ${Number(index) + 1} `);
    }
  });

  it('extracts first level snippet blocks (at the root of fragment) correctly', async () => {
    const ast = getSvelteAST({
      code: `
        <script context="module">
          import { defineMeta, setTemplate } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>

        <script>
          setTemplate(render);
        </script>

        {#snippet render(args)}
          <SampleComponent {...args} />
        {/snippet}

        {#snippet template1(args)}
          <SampleComponent {...args} />
        {/snippet}

        {#snippet template2(args)}
          <SampleComponent {...args} />
        {/snippet}

        <Story name="Example1" />

        <Story name="Example2">
          {#snippet children(args)}
            <SampleComponent {...args} />
          {/snippet}
        </Story>
      `,
    });
    const moduleNodes = await extractModuleNodes({ module: ast.module });
    const instanceNodes = await extractInstanceNodes({
      instance: ast.instance,
      moduleNodes,
    });
    const fragmentNodes = await extractFragmentNodes({
      fragment: ast.fragment,
      instanceNodes,
      moduleNodes,
    });

    expect(fragmentNodes.snippetBlocks).toHaveLength(3);
    expect(fragmentNodes.snippetBlocks[0].expression.name).toBe('render');
    expect(fragmentNodes.snippetBlocks[1].expression.name).toBe('template1');
    expect(fragmentNodes.snippetBlocks[2].expression.name).toBe('template2');
  });
});
