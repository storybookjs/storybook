import { describe, it } from 'vitest';

import { extractSvelteASTNodes } from './nodes';

import { getSvelteAST } from '#parser/ast';

describe(extractSvelteASTNodes.name, () => {
  it('works with a simple example', ({ expect }) => {
    const ast = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf"

          import Button from "./Button.svelte";

          const { Story, meta } = defineMeta({
            component: Button,
          });
        </script>

        <Story name="Default" />

        <Story name="Playground">
          {#snippet children(args)}
            <Button {...args} />
          {/snippet}
        </Story>
      `,
    });

    expect(extractSvelteASTNodes({ ast })).resolves.not.toThrow();
  });
});
