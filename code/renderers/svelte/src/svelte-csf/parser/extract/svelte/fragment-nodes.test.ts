import type { Identifier } from 'estree';
import { describe, expect, it } from 'vitest';

import { extractFragmentNodes } from './fragment-nodes.js';
import { getSvelteAST } from '../../../parser/ast.js';
import { extractInstanceNodes } from './instance-nodes.js';
import { extractModuleNodes } from './module-nodes.js';

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

  it("extracts 'setTemplateSnippet' correclty when NOT used", async () => {
    const ast = getSvelteAST({
      code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story name="Example" />
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

    expect(fragmentNodes.setTemplateSnippetBlock).not.toBeDefined();
  });

  it("extracts 'setTemplateSnippet' correclty when used with 'args' parameter only", async () => {
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
          <SampleChildren {...args} />
        {/snippet}

        <Story name="Example" />
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

    expect(fragmentNodes.setTemplateSnippetBlock).toBeDefined();
    expect(fragmentNodes.setTemplateSnippetBlock?.expression.name).toBe('render');
    expect(fragmentNodes.setTemplateSnippetBlock?.parameters).toHaveLength(1);
    expect((fragmentNodes.setTemplateSnippetBlock?.parameters[0] as Identifier).name).toBe('args');
  });

  it("extracts 'setTemplateSnippet' correclty when used with both 'args' and 'storyContext' parameters", async () => {
    const ast = getSvelteAST({
      code: `
        <script context="module">
          import { defineMeta, setTemplate } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>

        <script>
          setTemplate(myTemplate);
        </script>

        {#snippet myTemplate(args, storyContext)}
          <SampleChildren {...args} />
        {/snippet}

        <Story name="Example" />
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

    expect(fragmentNodes.setTemplateSnippetBlock).toBeDefined();
    expect(fragmentNodes.setTemplateSnippetBlock?.expression.name).toBe('myTemplate');
    expect(fragmentNodes.setTemplateSnippetBlock?.parameters).toHaveLength(2);
    expect((fragmentNodes.setTemplateSnippetBlock?.parameters[0] as Identifier).name).toBe('args');
    expect((fragmentNodes.setTemplateSnippetBlock?.parameters[1] as Identifier).name).toBe(
      'storyContext'
    );
  });
});
