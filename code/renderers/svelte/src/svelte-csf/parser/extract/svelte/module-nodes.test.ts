import { describe, it } from 'vitest';

import { extractModuleNodes } from './module-nodes';

import { getSvelteAST } from '#parser/ast';
import { StorybookSvelteCSFError } from '#utils/error';

describe(extractModuleNodes.name, () => {
  it('fails when module tag not found', ({ expect }) => {
    const { module } = getSvelteAST({
      code: `<script></script>`,
    });

    expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
      [SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0001 (MissingModuleTagError): The file '<path not specified>'
      does not have a module context (<script module> ... </script>).

      defineMeta(...) should be called inside a module script tag, like so:

      <script module>
      import { defineMeta } from "@storybook/addon-svelte-csf";

      const { Story } = defineMeta({});
      </script>

      More info: https://github.com/storybookjs/addon-svelte-csf/blob/v${StorybookSvelteCSFError.packageVersion}/ERRORS.md#SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0001
      ]
    `);
  });

  it("fails when 'defineMeta' not imported", ({ expect }) => {
    const { module } = getSvelteAST({
      code: `<script module></script>`,
    });

    expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
      [SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0003 (MissingDefineMetaImportError): The file '<path not specified>'
      does not import defineMeta from "@storybook/addon-svelte-csf" inside the module context.

      Make sure to import defineMeta from the package and use it inside the module context like so:

      <script module>
      import { defineMeta } from "@storybook/addon-svelte-csf";

      const { Story } = defineMeta({});
      </script>

      More info: https://github.com/storybookjs/addon-svelte-csf/blob/v${StorybookSvelteCSFError.packageVersion}/ERRORS.md#SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0003
      ]
    `);
  });

  it("fails when 'defineMeta' not used", ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf";
        </script>
      `,
    });

    expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
      [SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0004 (MissingDefineMetaVariableDeclarationError): The file '<path not specified>'
      does not store the result of calling defineMeta(). While defineMeta() might have been called,
      it's return value needs to be stored and destructured for the parsing to succeed, eg.:

      <script module>
      import { defineMeta } from "@storybook/addon-svelte-csf";

      const { Story } = defineMeta({});
      </script>

      More info: https://github.com/storybookjs/addon-svelte-csf/blob/v${StorybookSvelteCSFError.packageVersion}/ERRORS.md#SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0004
      ]
    `);
  });

  it("fails when 'Story' is not destructured", ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf"
          defineMeta();
        </script>`,
    });

    expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
      [SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0004 (MissingDefineMetaVariableDeclarationError): The file '<path not specified>'
      does not store the result of calling defineMeta(). While defineMeta() might have been called,
      it's return value needs to be stored and destructured for the parsing to succeed, eg.:

      <script module>
      import { defineMeta } from "@storybook/addon-svelte-csf";

      const { Story } = defineMeta({});
      </script>

      More info: https://github.com/storybookjs/addon-svelte-csf/blob/v${StorybookSvelteCSFError.packageVersion}/ERRORS.md#SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0004
      ]
    `);
  });

  it('works when it has valid required entry snippet', ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>`,
    });

    expect(extractModuleNodes({ module })).resolves.not.toThrow();
  });

  it('works when meta was destructured too', ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script module>
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
        <script module>
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
        <script module>
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
        <script module>
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
