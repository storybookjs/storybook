import { describe, expect, it } from 'vitest';

import { extractStoryAttributesNodes } from './attributes.ts';

import { getSvelteAST } from '../../../ast.ts';
import { extractSvelteASTNodes } from '../nodes.ts';

describe(extractStoryAttributesNodes.name, () => {
  it("extracts the selected '<Story />' attributes", async () => {
    const ast = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/svelte"
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
    expect(attributes.name?.value).toMatchObject([{ type: 'Text', data: 'Default' }]);
    expect(attributes.args).toBeUndefined();
  });

  it('ignores the attributes of the children components of <Story>', async () => {
    const ast = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/svelte"
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
    expect(attributes.name?.value).toMatchObject([{ type: 'Text', data: 'Default' }]);
    expect(attributes.args).toBeUndefined();
  });
});
