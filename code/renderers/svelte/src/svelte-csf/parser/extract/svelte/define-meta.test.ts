import type { ArrayExpression, Literal } from 'estree';
import { describe, it } from 'vitest';

import { extractDefineMetaPropertiesNodes } from './define-meta';

import { getSvelteAST } from '#parser/ast';
import { extractSvelteASTNodes } from '#parser/extract/svelte/nodes';

describe(extractDefineMetaPropertiesNodes.name, () => {
  it('extracts correctly selected properties', async ({ expect }) => {
    const ast = getSvelteAST({
      code: `
        <script context="module">
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

    expect((properties.title?.value as Literal).value).toBe('My Story');
    expect((properties.id?.value as Literal).value).toBe('custom-id');
    expect(((properties.tags?.value as ArrayExpression).elements[0] as Literal).value).toBe(
      'autodocs'
    );
    expect(((properties.tags?.value as ArrayExpression).elements[1] as Literal).value).toBe('!dev');
    expect(properties.args).toBeUndefined();
    expect(properties.parameters).toBeUndefined();
  });
});
