import { print } from 'svelte-ast-print';
import { describe, it } from 'vitest';

import { transformImportDeclaration } from './import-declaration.js';

import type { ESTreeAST } from '$lib/parser/ast.js';
import { parseAndExtractSvelteNode } from '../../../../../tests/extractor.js';

describe(transformImportDeclaration.name, () => {
  it("removes legacy components and add 'defineMeta'", async ({ expect }) => {
    const code = `
      <script context="module" lang="ts">
        import { Story, Template } from "@storybook/addon-svelte-csf";
      </script>
    `;
    const node = await parseAndExtractSvelteNode<ESTreeAST.ImportDeclaration>(
      code,
      'ImportDeclaration'
    );

    expect(print(transformImportDeclaration({ node }))).toMatchInlineSnapshot(
      `"import { defineMeta } from "@storybook/addon-svelte-csf";"`
    );
  });

  it("it doesn't remove existing 'defineMeta'", async ({ expect }) => {
    const code = `
      <script context="module" lang="ts">
        import { Story, Template, defineMeta } from "@storybook/addon-svelte-csf";
      </script>
    `;
    const node = await parseAndExtractSvelteNode<ESTreeAST.ImportDeclaration>(
      code,
      'ImportDeclaration'
    );

    expect(print(transformImportDeclaration({ node }))).toMatchInlineSnapshot(
      `"import { defineMeta } from "@storybook/addon-svelte-csf";"`
    );
  });

  it("it doesn't remove existing 'setTemplate'", async ({ expect }) => {
    const code = `
      <script context="module" lang="ts">
        import { defineMeta, setTemplate } from "@storybook/addon-svelte-csf";
      </script>
    `;
    const node = await parseAndExtractSvelteNode<ESTreeAST.ImportDeclaration>(
      code,
      'ImportDeclaration'
    );

    expect(print(transformImportDeclaration({ node }))).toMatchInlineSnapshot(
      `"import { defineMeta, setTemplate } from "@storybook/addon-svelte-csf";"`
    );
  });
});
