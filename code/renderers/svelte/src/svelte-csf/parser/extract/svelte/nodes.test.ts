import { describe, expect, it } from 'vitest';

import { extractSvelteASTNodes } from './nodes.js';
import { getSvelteAST } from '../../../parser/ast.js';

describe(extractSvelteASTNodes.name, () => {
  it('fails when module tag not found', () => {
    const ast = getSvelteAST({
      source: `<script></script>`,
    });

    expect(extractSvelteASTNodes({ ast })).rejects.toThrow();
  });

  it("fails when 'defineMeta' not imported", () => {
    const ast = getSvelteAST({
      source: `<script context="module"></script>`,
    });

    expect(extractSvelteASTNodes({ ast })).rejects.toThrow();
  });

  it("fails when 'defineMeta' not used", () => {
    const ast = getSvelteAST({
      source: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf";
        </script>
      `,
    });

    expect(extractSvelteASTNodes({ ast })).rejects.toThrow();
  });

  it("fails when 'Story' not destructured", () => {
    const ast = getSvelteAST({
      source: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          defineMeta();
        </script>`,
    });

    expect(extractSvelteASTNodes({ ast })).rejects.toThrow();
  });

  it('works when it has valid required snippet', () => {
    const ast = getSvelteAST({
      source: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>`,
    });

    expect(extractSvelteASTNodes({ ast })).resolves.not.toThrow();
  });

  it('works on renamed identifiers', () => {
    const ast = getSvelteAST({
      source: `
        <script context="module">
          import { defineMeta as dm } from "@storybook/addon-svelte-csf"
          const { Story: S, meta: m } = dm();
        </script>`,
    });

    expect(extractSvelteASTNodes({ ast })).resolves.not.toThrow();
  });
});
