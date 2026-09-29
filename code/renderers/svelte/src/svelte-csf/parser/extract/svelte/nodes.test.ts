import { describe, it } from 'vitest';

import { extractSvelteASTNodes } from './nodes.ts';

import { getSvelteAST } from '../../ast.ts';

describe(extractSvelteASTNodes.name, () => {
  it('works with a simple example', async ({ expect }) => {
    const ast = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/svelte/csf"

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

    await expect(extractSvelteASTNodes({ ast })).resolves.not.toThrow();
  });
});
