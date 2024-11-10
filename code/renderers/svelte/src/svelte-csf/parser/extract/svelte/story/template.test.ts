import { describe, it } from 'vitest';

import { extractStoryTemplateSnippetBlock } from './template';

import { getSvelteAST } from '#parser/ast';
import { extractSvelteASTNodes } from '#parser/extract/svelte/nodes';

describe(extractStoryTemplateSnippetBlock.name, () => {
  it('returns correctly AST node, when a `<Story>` compponent has a snippet block `template` inside', async ({
    expect,
  }) => {
    const code = `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf";

          import SampleComponent from "./SampleComponent.svelte";

          const { Story } = defineMeta({
            component: SampleComponent,
          });
        </script>

        <Story name="With template">
          {#snippet template(args)}
            <SomeComponent {...args} />
          {/snippet}
        </Story>
      `;

    const ast = getSvelteAST({ code });
    const svelteASTNodes = await extractSvelteASTNodes({ ast });
    const { storyComponents } = svelteASTNodes;
    const component = storyComponents[0].component;

    expect(extractStoryTemplateSnippetBlock(component)).toBeDefined();
    expect(extractStoryTemplateSnippetBlock(component)?.expression.name).toBe('template');
  });

  it('returns undefined, when a `<Story>` compponent is a self-closing tag', async ({ expect }) => {
    const code = `
        <script module>
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

    expect(extractStoryTemplateSnippetBlock(component)).not.toBeDefined();
  });
});
