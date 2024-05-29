import { describe, it } from 'vitest';

import { extractMetaPropertiesNodes } from './meta-properties';
import { getSvelteAST } from '../ast.js';
import { extractSvelteASTNodes } from './svelte/nodes.js';
import type { ArrayExpression, Literal } from 'estree';

describe(extractMetaPropertiesNodes.name, () => {
  it('extracts correctly selected properties', async ({ expect }) => {
    const ast = getSvelteAST({
      source: `
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
    const properties = extractMetaPropertiesNodes({
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
