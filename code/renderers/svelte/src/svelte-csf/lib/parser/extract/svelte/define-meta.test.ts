import { describe, it } from 'vitest';

import { extractDefineMetaPropertiesNodes } from './define-meta';

import { getSvelteAST, type ESTreeAST } from '$lib/parser/ast';
import { extractSvelteASTNodes } from '$lib/parser/extract/svelte/nodes';

describe(extractDefineMetaPropertiesNodes.name, () => {
  it('extracts correctly selected properties', async ({ expect }) => {
    const ast = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf"

          const { Story } = defineMeta({
            title: "My Story",
            id: "custom-id",
            tags: ["autodocs", "!dev"],
          });
        </script>
      `,
    });
    const nodes = await extractSvelteASTNodes({ ast });
    const properties = extractDefineMetaPropertiesNodes({
      nodes,
      properties: ['title', 'id', 'tags', 'args', 'parameters'],
    });

    expect((properties.title?.value as ESTreeAST.Literal).value).toBe('My Story');
    expect((properties.id?.value as ESTreeAST.Literal).value).toBe('custom-id');
    expect(
      ((properties.tags?.value as ESTreeAST.ArrayExpression).elements[0] as ESTreeAST.Literal).value
    ).toBe('autodocs');
    expect(
      ((properties.tags?.value as ESTreeAST.ArrayExpression).elements[1] as ESTreeAST.Literal).value
    ).toBe('!dev');
    expect(properties.args).toBeUndefined();
    expect(properties.parameters).toBeUndefined();
  });
});
