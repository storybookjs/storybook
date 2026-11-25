import { describe, expect, it } from 'vitest';

import { extractFragmentNodes } from './fragment-nodes.ts';
import { extractModuleNodes } from './module-nodes.ts';

import { getSvelteAST } from '../../ast.ts';

describe(extractFragmentNodes.name, () => {
  it("extracts each '<Story />' component without a comment", async () => {
    const ast = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/svelte"
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
    const fragmentNodes = await extractFragmentNodes({
      fragment: ast.fragment,
      moduleNodes,
    });

    expect(fragmentNodes.storyComponents).toHaveLength(5);
    for (const story of fragmentNodes.storyComponents) {
      expect(story.comment).toBeUndefined();
    }
    expect(fragmentNodes.snippetBlocks).toHaveLength(0);
  });

  it("extracts the HTML comment before each '<Story />' component", async () => {
    const ast = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/svelte"
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
    const fragmentNodes = await extractFragmentNodes({
      fragment: ast.fragment,
      moduleNodes,
    });

    expect(fragmentNodes.storyComponents).toHaveLength(5);
    for (const [index, story] of Object.entries(fragmentNodes.storyComponents)) {
      expect(story.comment?.data).toBe(` Comment ${Number(index) + 1} `);
    }
  });

  describe("the HTML comment of a '<Story />' component", () => {
    const script = `
      <script module>
        import { defineMeta } from "@storybook/svelte"
        const { Story } = defineMeta();
      </script>`;

    it.each([
      {
        name: 'takes the comment directly above, also with a blank line between them',
        code: `${script}
          <!-- Above a story -->

          <Story name="1" />`,
        expected: ' Above a story ',
      },
      {
        name: 'ignores a comment above a snippet block',
        code: `${script}
          <!-- Above a snippet -->
          {#snippet template()}<span />{/snippet}
          <Story name="1" />`,
        expected: undefined,
      },
      {
        name: 'ignores a comment inside the element before the story',
        code: `${script}
          <div><!-- Inside an element --></div>
          <Story name="1" />`,
        expected: undefined,
      },
      {
        name: "ignores a file-header comment above '<script module>'",
        code: `
          <!-- File header -->${script}
          <Story name="1" />`,
        expected: undefined,
      },
      {
        name: "ignores a comment above a '<style>' tag",
        code: `${script}
          <!-- Above the styles -->
          <style>p { color: red; }</style><Story name="1" />`,
        expected: undefined,
      },
    ])('$name', async ({ code, expected }) => {
      const ast = getSvelteAST({ code });
      const moduleNodes = await extractModuleNodes({ module: ast.module });
      const fragmentNodes = await extractFragmentNodes({ fragment: ast.fragment, moduleNodes });

      expect(fragmentNodes.storyComponents.map((story) => story.comment?.data)).toEqual([expected]);
    });
  });

  it('extracts the snippet blocks at the root of the fragment', async () => {
    const ast = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/svelte"
          const { Story } = defineMeta({
            render,
          });
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
          {#snippet template(args)}
            <SampleComponent {...args} />
          {/snippet}
        </Story>
      `,
    });
    const moduleNodes = await extractModuleNodes({ module: ast.module });
    const fragmentNodes = await extractFragmentNodes({
      fragment: ast.fragment,
      moduleNodes,
    });

    expect(fragmentNodes.snippetBlocks).toHaveLength(3);
    expect(fragmentNodes.snippetBlocks[0].expression.name).toBe('render');
    expect(fragmentNodes.snippetBlocks[1].expression.name).toBe('template1');
    expect(fragmentNodes.snippetBlocks[2].expression.name).toBe('template2');
  });
});
