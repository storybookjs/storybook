import { describe, expect, it } from 'vitest';

import { extractFragmentNodes } from './fragment-nodes.js';
import { extractSvelteASTNodes } from './nodes.js';
import { getSvelteAST } from '../../../parser/ast.js';

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
    const nodes = await extractSvelteASTNodes({ ast });
    const fragmentNodes = await extractFragmentNodes({
      fragment: ast.fragment,
      moduleNodes: nodes,
    });

    expect(fragmentNodes.storyComponents).toHaveLength(5);
    for (const story of fragmentNodes.storyComponents) {
      expect(story.comment).toBeUndefined();
    }
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
    const nodes = await extractSvelteASTNodes({ ast });
    const fragmentNodes = await extractFragmentNodes({
      fragment: ast.fragment,
      moduleNodes: nodes,
    });

    expect(fragmentNodes.storyComponents).toHaveLength(5);
    for (const [index, story] of Object.entries(fragmentNodes.storyComponents)) {
      expect(story.comment?.data).toBe(` Comment ${Number(index) + 1} `);
    }
  });
});
