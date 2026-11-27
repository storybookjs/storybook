import { describe, expect, it } from 'vitest';

import { extractStoryTemplateSnippetBlock } from './template.ts';

import { getSvelteAST } from '../../../ast.ts';
import { extractSvelteASTNodes } from '../nodes.ts';

describe(extractStoryTemplateSnippetBlock.name, () => {
  it('returns the `template` snippet block inside a `<Story>` component', async () => {
    const code = `
        <script module>
          import { defineMeta } from "@storybook/svelte";

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

  it('returns undefined for a self-closing `<Story>` component', async () => {
    const code = `
        <script module>
          import { defineMeta } from "@storybook/svelte";

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
