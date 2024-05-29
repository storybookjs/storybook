import { describe, it } from 'vitest';

import { extractModuleNodes } from './module-nodes.js';
import { getSvelteAST } from '../../../parser/ast.js';

describe(extractModuleNodes.name, () => {
  it('fails when module tag not found', ({ expect }) => {
    const { module } = getSvelteAST({
      source: `<script></script>`,
    });

    expect(extractModuleNodes({ module })).rejects.toThrow();
  });

  it("fails when 'defineMeta' not imported", ({ expect }) => {
    const { module } = getSvelteAST({
      source: `<script context="module"></script>`,
    });

    expect(extractModuleNodes({ module })).rejects.toThrow();
  });

  it("fails when 'defineMeta' not used", ({ expect }) => {
    const { module } = getSvelteAST({
      source: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf";
        </script>
      `,
    });

    expect(extractModuleNodes({ module })).rejects.toThrow();
  });

  it("fails when 'Story' is not destructured", ({ expect }) => {
    const { module } = getSvelteAST({
      source: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          defineMeta();
        </script>`,
    });

    expect(extractModuleNodes({ module })).rejects.toThrow();
  });

  it('works when it has valid required entry snippet', ({ expect }) => {
    const { module } = getSvelteAST({
      source: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>`,
    });

    expect(extractModuleNodes({ module })).resolves.not.toThrow();
  });

  it('works when meta was destructured too', ({ expect }) => {
    const { module } = getSvelteAST({
      source: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story, meta } = defineMeta();
        </script>
      `,
    });

    expect(extractModuleNodes({ module })).resolves.not.toThrow();
  });

  it('works on renamed identifiers', ({ expect }) => {
    const { module } = getSvelteAST({
      source: `
        <script context="module">
          import { defineMeta as dm } from "@storybook/addon-svelte-csf"
          const { Story: S, meta: m } = dm();
        </script>
      `,
    });

    expect(extractModuleNodes({ module })).resolves.not.toThrow();
  });
});
