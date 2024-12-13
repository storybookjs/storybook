import { describe, expect, it } from 'vitest';

import { extractStoryAttributesNodes } from './attributes.js';

import { getSvelteAST } from '$lib/parser/ast.js';
import { extractSvelteASTNodes } from '$lib/parser/extract/svelte/nodes.js';

describe(extractStoryAttributesNodes.name, () => {
  it("extracts '<Story />' attributes correctly", async () => {
    const ast = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story name="Default" />
      `,
    });
    const nodes = await extractSvelteASTNodes({ ast });
    const { component } = nodes.storyComponents[0];
    const attributes = extractStoryAttributesNodes({
      component,
      attributes: ['name', 'args'],
    });

    expect(attributes.name).not.toBeUndefined();
    expect(attributes.name?.name).toBe('name');
    expect(attributes.name?.value[0].data).toBe('Default');
    expect(attributes.args).toBeUndefined();
  });

  it('it ignores the attributes of <Story> children components', async () => {
    const ast = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story name="Default">
          <Icon name="close" />
        </Story>
      `,
    });
    const nodes = await extractSvelteASTNodes({ ast });
    const { component } = nodes.storyComponents[0];
    const attributes = extractStoryAttributesNodes({
      component,
      attributes: ['name', 'args'],
    });

    expect(attributes.name).not.toBeUndefined();
    expect(attributes.name?.name).toBe('name');
    expect(attributes.name?.value[0].data).toBe('Default');
    expect(attributes.args).toBeUndefined();
  });
});
