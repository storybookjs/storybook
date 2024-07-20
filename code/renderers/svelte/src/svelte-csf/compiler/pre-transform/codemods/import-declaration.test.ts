import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import type { ImportDeclaration } from 'estree';
import { print } from 'svelte-ast-print';
import { describe, it } from 'vitest';

import { transformImportDeclaration } from './import-declaration';

import { parseAndExtractSvelteNode } from '#tests/extractor';

describe(transformImportDeclaration.name, () => {
  it("removes legacy components and add 'defineMeta'", async ({ expect }) => {
    const code = `
      <script context="module" lang="ts">
        import { Story, Template } from "${pkg.name}";
      </script>
    `;
    const node = await parseAndExtractSvelteNode<ImportDeclaration>(code, 'ImportDeclaration');

    expect(print(transformImportDeclaration({ node }))).toMatchInlineSnapshot(
      `"import { defineMeta } from "${pkg.name}";"`
    );
  });

  it("it doesn't remove existing 'defineMeta'", async ({ expect }) => {
    const code = `
      <script context="module" lang="ts">
        import { Story, Template, defineMeta } from "${pkg.name}";
      </script>
    `;
    const node = await parseAndExtractSvelteNode<ImportDeclaration>(code, 'ImportDeclaration');

    expect(print(transformImportDeclaration({ node }))).toMatchInlineSnapshot(
      `"import { defineMeta } from "${pkg.name}";"`
    );
  });

  it("it doesn't remove existing 'setTemplate'", async ({ expect }) => {
    const code = `
      <script context="module" lang="ts">
        import { defineMeta, setTemplate } from "${pkg.name}";
      </script>
    `;
    const node = await parseAndExtractSvelteNode<ImportDeclaration>(code, 'ImportDeclaration');

    expect(print(transformImportDeclaration({ node }))).toMatchInlineSnapshot(
      `"import { defineMeta, setTemplate } from "${pkg.name}";"`
    );
  });
});
