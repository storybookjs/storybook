import { describe, expect, it } from 'vitest';

import { extractStoryAttributesNodes } from './attributes.js';
import { extractSvelteASTNodes } from '../nodes.js';
import { getSvelteAST } from '../../../ast.js';

describe(extractStoryAttributesNodes.name, () => {
  it("extracts '<Story />' attributes correctly", async () => {
    const ast = getSvelteAST({
      source: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story name="Default" />
      `,
    });
    const nodes = await extractSvelteASTNodes({ ast });
    const { component } = nodes.storyComponents[0];
    const attributes = await extractStoryAttributesNodes({
      component,
      attributes: ['name', 'args'],
    });

    expect(attributes.name).not.toBeUndefined();
    expect(attributes.name?.name).toBe('name');
    expect(attributes.name?.value[0].data).toBe('Default');
    expect(attributes.args).toBeUndefined();
  });
});
