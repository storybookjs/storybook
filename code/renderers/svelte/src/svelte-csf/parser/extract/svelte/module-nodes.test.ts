import { describe, it } from 'vitest';

import { extractModuleNodes } from './module-nodes';

import { getSvelteAST } from '#parser/ast';

describe(extractModuleNodes.name, () => {
  it('fails when module tag not found', ({ expect }) => {
    const { module } = getSvelteAST({
      code: `<script></script>`,
    });

    expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
      [SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0001 (MissingModuleTagError): Stories file: <path not specified>
      doesn't have a module tag _(\`<script context="module"> <!-- ... --> </script>\`)_.

      Make sure this stories file has initial code snippet in order for this addon to work correctly:

      <script context="module">
      import { defineMeta } from "@storybook/addon-svelte-csf";

      const { Story } = defineMeta({});
      </script>]
    `);
  });

  it("fails when 'defineMeta' not imported", ({ expect }) => {
    const { module } = getSvelteAST({
      code: `<script context="module"></script>`,
    });

    expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
      [SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0003 (MissingDefineMetaImportError): Stories file: <path not specified>
      doesn't have a 'defineMeta' imported from the "@storybook/addon-svelte-csf" package inside the module tag.
      ('<script context="module"> <!-- ... --> </script>').

      Make sure this stories file has initial code snippet in order for this addon to work correctly:

      <script context="module">
      import { defineMeta } from "@storybook/addon-svelte-csf";

      const { Story } = defineMeta({});
      </script>]
    `);
  });

  it("fails when 'defineMeta' not used", ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf";
        </script>
      `,
    });

    expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
      [SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0004 (MissingDefineMetaVariableDeclarationError): Stories file: <path not specified>
      doesn't have 'defineMeta' call used for variable declaration inside the module tag ('<script context="module"> <!-- ... --> </script>').

      Make sure this stories file has initial code snippet in order for this addon to work correctly:

      <script context="module">
      import { defineMeta } from "@storybook/addon-svelte-csf";

      const { Story } = defineMeta({});
      </script>]
    `);
  });

  it("fails when 'Story' is not destructured", ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          defineMeta();
        </script>`,
    });

    expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
      [SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0004 (MissingDefineMetaVariableDeclarationError): Stories file: <path not specified>
      doesn't have 'defineMeta' call used for variable declaration inside the module tag ('<script context="module"> <!-- ... --> </script>').

      Make sure this stories file has initial code snippet in order for this addon to work correctly:

      <script context="module">
      import { defineMeta } from "@storybook/addon-svelte-csf";

      const { Story } = defineMeta({});
      </script>]
    `);
  });

  it('works when it has valid required entry snippet', ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>`,
    });

    expect(extractModuleNodes({ module })).resolves.not.toThrow();
  });

  it('works when meta was destructured too', ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story, meta } = defineMeta();
        </script>
      `,
    });

    expect(extractModuleNodes({ module })).resolves.not.toThrow();
  });

  it("works when 'setTemplate' is used in stories", async ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script context="module">
          import { defineMeta, setTemplate } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
      `,
    });

    const nodes = await extractModuleNodes({ module });

    expect(nodes.defineMetaImport).toBeDefined();
    expect(nodes.defineMetaImport.imported.name).toBe('defineMeta');
    expect(nodes.setTemplateImport).toBeDefined();
    expect(nodes.setTemplateImport?.local.name).toBe('setTemplate');
    expect(nodes.defineMetaVariableDeclaration).toBeDefined();
    expect(nodes.storyIdentifier).toBeDefined();
    expect(nodes.storyIdentifier.name).toBe('Story');
  });

  it("works when 'setTemplate' is NOT used in stories", async ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
      `,
    });

    const nodes = await extractModuleNodes({ module });

    expect(nodes.defineMetaImport).toBeDefined();
    expect(nodes.setTemplateImport).toBeUndefined();
    expect(nodes.defineMetaVariableDeclaration).toBeDefined();
    expect(nodes.storyIdentifier).toBeDefined();
  });

  it('works on renamed identifiers', async ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script context="module">
          import { defineMeta as dm, setTemplate as st } from "@storybook/addon-svelte-csf"
          const { Story: S, meta: m } = dm();
        </script>
      `,
    });

    const nodes = await extractModuleNodes({ module });

    expect(nodes.defineMetaImport.local.name).toBe('dm');
    expect(nodes.setTemplateImport?.local.name).toBe('st');
    expect(nodes.defineMetaVariableDeclaration).toBeDefined();
    expect(nodes.storyIdentifier.name).toBe('S');
  });
});
