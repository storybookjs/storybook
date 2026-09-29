import { describe, it } from 'vitest';

import { extractModuleNodes } from './module-nodes.js';

import { getSvelteAST } from '$lib/parser/ast.js';
import { StorybookSvelteCSFError } from '$lib/utils/error.js';

describe(extractModuleNodes.name, () => {
  it('fails when module tag not found', async ({ expect }) => {
    const { module } = getSvelteAST({
      code: `<script></script>`,
    });

    await expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
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

  it("fails when 'defineMeta' not imported", async ({ expect }) => {
    const { module } = getSvelteAST({
      code: `<script module></script>`,
    });

    await expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
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

  it("fails when 'defineMeta' not used", async ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf";
        </script>
      `,
    });

    await expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
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

  it("fails when 'Story' is not destructured", async ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf"
          defineMeta();
        </script>`,
    });

    await expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
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

  it('works when it has valid required entry snippet', async ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>`,
    });

    await expect(extractModuleNodes({ module })).resolves.not.toThrow();
  });

  it('works when meta was destructured too', async ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story, meta } = defineMeta();
        </script>
      `,
    });

    await expect(extractModuleNodes({ module })).resolves.not.toThrow();
  });

  it('extracts module nodes', async ({ expect }) => {
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
    expect(nodes.defineMetaImport.imported.name).toBe('defineMeta');
    expect(nodes.defineMetaVariableDeclaration).toBeDefined();
    expect(nodes.storyIdentifier).toBeDefined();
    expect(nodes.storyIdentifier.name).toBe('Story');
  });

  it('extracts module nodes with renamed identifiers', async ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script module>
          import { defineMeta as dm } from "@storybook/addon-svelte-csf"
          const { Story: S, meta: m } = dm();
        </script>
      `,
    });

    const nodes = await extractModuleNodes({ module });

    expect(nodes.defineMetaImport.local.name).toBe('dm');
    expect(nodes.defineMetaVariableDeclaration).toBeDefined();
    expect(nodes.storyIdentifier.name).toBe('S');
  });
});
