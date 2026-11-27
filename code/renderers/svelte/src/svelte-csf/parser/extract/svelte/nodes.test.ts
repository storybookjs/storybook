import { describe, expect, it } from 'vitest';

import { extractSvelteASTNodes } from './nodes.ts';

import { getSvelteAST } from '../../ast.ts';

describe(extractSvelteASTNodes.name, () => {
  it('extracts the module nodes and the Story components', async () => {
    const ast = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/svelte"

          import Button from "./Button.svelte";

          const { Story, meta } = defineMeta({
            component: Button,
          });
        </script>

        <Story name="Default" />

        <Story name="Playground">
          {#snippet template(args)}
            <Button {...args} />
          {/snippet}
        </Story>
      `,
    });

    const nodes = await extractSvelteASTNodes({ ast });

    expect(nodes.storyNames).toEqual(['Story']);
    expect(nodes.storyComponents.map(({ component }) => component.name)).toEqual([
      'Story',
      'Story',
    ]);
  });
});
