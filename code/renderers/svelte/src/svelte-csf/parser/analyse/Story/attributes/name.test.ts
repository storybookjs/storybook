import { describe, expect, it } from 'vitest';

import { getNameFromStoryAttribute } from './name.js';
import { getSvelteAST } from '../../../ast.js';
import { extractSvelteASTNodes } from '../../../extract/svelte/nodes.js';
import { extractStoryAttributesNodes } from '../../../extract/svelte/Story/attributes.js';

describe(getNameFromStoryAttribute.name, () => {
  it("extracts 'name' attribute when is a Text string", async () => {
    const ast = getSvelteAST({
      source: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story name="Text" />
      `,
    });
    const nodes = await extractSvelteASTNodes({ ast });
    const { component } = nodes.storyComponents[0];
    const { name } = extractStoryAttributesNodes({
      component,
      attributes: ['name'],
    });

    expect(() => getNameFromStoryAttribute({ node: name })).not.toThrow();
    expect(getNameFromStoryAttribute({ node: name })).toBeTypeOf('string');
    expect(getNameFromStoryAttribute({ node: name })).toBe('Text');
  });

  it("extracts 'name' attribute when is an expression with literal", async () => {
    const ast = getSvelteAST({
      source: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story name={"Expression with literal"} />
      `,
    });
    const nodes = await extractSvelteASTNodes({ ast });
    const { component } = nodes.storyComponents[0];
    const { name } = extractStoryAttributesNodes({
      component,
      attributes: ['name'],
    });

    expect(() => getNameFromStoryAttribute({ node: name })).not.toThrow();
    expect(getNameFromStoryAttribute({ node: name })).toBeTypeOf('string');
    expect(getNameFromStoryAttribute({ node: name })).toBe('Expression with literal');
  });

  it("fails when '<Story />' doesn't provide a 'name' attribute prop", async () => {
    const ast = getSvelteAST({
      source: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story />
      `,
    });
    const nodes = await extractSvelteASTNodes({ ast });
    const { component } = nodes.storyComponents[0];
    const { name } = extractStoryAttributesNodes({
      component,
      attributes: ['name'],
    });

    expect(() => getNameFromStoryAttribute({ node: name })).toThrow();
  });

  it("it ignores the 'name' attribute of '<Story>'s children component", async () => {
    const ast = getSvelteAST({
      source: `
        <script context="module">
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
    const { name } = extractStoryAttributesNodes({
      component,
      attributes: ['name', 'args'],
    });

    expect(() => getNameFromStoryAttribute({ node: name })).not.toThrow();
    expect(getNameFromStoryAttribute({ node: name })).toBeTypeOf('string');
    expect(getNameFromStoryAttribute({ node: name })).toBe('Default');
  });
});
