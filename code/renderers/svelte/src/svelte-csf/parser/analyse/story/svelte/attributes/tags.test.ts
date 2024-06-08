import { describe, expect, it } from 'vitest';

import { getTagsFromStoryAttribute } from './tags';

import { getSvelteAST } from '#parser/ast';
import { extractSvelteASTNodes } from '#parser/extract/svelte/nodes';
import { extractStoryAttributesNodes } from '#parser/extract/svelte/story/attributes';

describe(getTagsFromStoryAttribute.name, () => {
  it("extracts 'tags' attribute when is a correct type - array of strings", async () => {
    const ast = getSvelteAST({
      code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story name="Default" tags={["autodocs", "!dev"]} />
      `,
    });
    const nodes = await extractSvelteASTNodes({ ast });
    const { component } = nodes.storyComponents[0];
    const { tags } = extractStoryAttributesNodes({
      component,
      attributes: ['tags'],
    });

    expect(() => getTagsFromStoryAttribute({ node: tags })).not.toThrow();
    expect(getTagsFromStoryAttribute({ node: tags })).toBeInstanceOf(Array);
    expect(getTagsFromStoryAttribute({ node: tags })).toEqual(['autodocs', '!dev']);
  });

  it("returns empty array when 'tags' attribute is not provided", async () => {
    const ast = getSvelteAST({
      code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story name="Default" />
      `,
    });
    const nodes = await extractSvelteASTNodes({ ast });
    const { component } = nodes.storyComponents[0];
    const { tags } = extractStoryAttributesNodes({
      component,
      attributes: ['tags'],
    });

    expect(() => getTagsFromStoryAttribute({ node: tags })).not.toThrow();
    expect(getTagsFromStoryAttribute({ node: tags })).toEqual([]);
  });
});
