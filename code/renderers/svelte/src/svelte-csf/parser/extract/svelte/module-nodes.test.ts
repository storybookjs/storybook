import { describe, it } from 'vitest';

import { extractModuleNodes } from './module-nodes.ts';

import { SVELTE_CSF_IMPORT_SOURCES } from '../../../constants.ts';

import { getSvelteAST } from '../../ast.ts';

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
        import { defineMeta } from "@storybook/svelte-vite";
        
        const { Story } = defineMeta({});
      </script>

      In a SvelteKit project, import defineMeta from "@storybook/sveltekit".

      More info: https://github.com/storybookjs/storybook/blob/v<version>/code/renderers/svelte/src/svelte-csf/ERRORS.md#SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0001
      ]
    `);
  });

  it("fails when 'defineMeta' not imported", async ({ expect }) => {
    const { module } = getSvelteAST({
      code: `<script module></script>`,
    });

    await expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
      [SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0003 (MissingDefineMetaImportError): The file '<path not specified>'
      does not import defineMeta from "@storybook/svelte-vite" or "@storybook/sveltekit" inside the module context.

      Make sure to import defineMeta from the package and use it inside the module context like so:

      <script module>
        import { defineMeta } from "@storybook/svelte-vite";
        
        const { Story } = defineMeta({});
      </script>

      In a SvelteKit project, import defineMeta from "@storybook/sveltekit".

      More info: https://github.com/storybookjs/storybook/blob/v<version>/code/renderers/svelte/src/svelte-csf/ERRORS.md#SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0003
      ]
    `);
  });

  it("fails when 'defineMeta' not used", async ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/svelte";
        </script>
      `,
    });

    await expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
      [SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0004 (MissingDefineMetaVariableDeclarationError): The file '<path not specified>'
      does not store the result of calling defineMeta(). While defineMeta() might have been called,
      it's return value needs to be stored and destructured for the parsing to succeed, eg.:

      <script module>
        import { defineMeta } from "@storybook/svelte-vite";
        
        const { Story } = defineMeta({});
      </script>

      In a SvelteKit project, import defineMeta from "@storybook/sveltekit".

      More info: https://github.com/storybookjs/storybook/blob/v<version>/code/renderers/svelte/src/svelte-csf/ERRORS.md#SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0004
      ]
    `);
  });

  it("fails when 'Story' is not destructured", async ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/svelte"
          defineMeta();
        </script>`,
    });

    await expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
      [SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0004 (MissingDefineMetaVariableDeclarationError): The file '<path not specified>'
      does not store the result of calling defineMeta(). While defineMeta() might have been called,
      it's return value needs to be stored and destructured for the parsing to succeed, eg.:

      <script module>
        import { defineMeta } from "@storybook/svelte-vite";
        
        const { Story } = defineMeta({});
      </script>

      In a SvelteKit project, import defineMeta from "@storybook/sveltekit".

      More info: https://github.com/storybookjs/storybook/blob/v<version>/code/renderers/svelte/src/svelte-csf/ERRORS.md#SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0004
      ]
    `);
  });

  it('works when it has valid required entry snippet', async ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/svelte"
          const { Story } = defineMeta();
        </script>`,
    });

    await expect(extractModuleNodes({ module })).resolves.not.toThrow();
  });

  it('works when meta was destructured too', async ({ expect }) => {
    const { module } = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/svelte"
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
          import { defineMeta } from "@storybook/svelte"
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
          import { defineMeta as dm } from "@storybook/svelte"
          const { Story: S, meta: m } = dm();
        </script>
      `,
    });

    const nodes = await extractModuleNodes({ module });

    expect(nodes.defineMetaImport.local.name).toBe('dm');
    expect(nodes.defineMetaVariableDeclaration).toBeDefined();
    expect(nodes.storyIdentifier.name).toBe('S');
  });

  it.for(SVELTE_CSF_IMPORT_SOURCES)(
    'finds defineMeta imported from %s',
    async (source, { expect }) => {
      const { module } = getSvelteAST({
        code: `
        <script module>
          import { defineMeta } from "${source}";
          const { Story } = defineMeta();
        </script>
      `,
      });

      const nodes = await extractModuleNodes({ module });

      expect(nodes.defineMetaImport.local.name).toBe('defineMeta');
    }
  );

  describe('other imports of @storybook/svelte', () => {
    it('ignores a type-only import next to defineMeta', async ({ expect }) => {
      const { module } = getSvelteAST({
        code: `
          <script module lang="ts">
            import type { Meta } from "@storybook/svelte";
            import { defineMeta } from "@storybook/svelte";
            const { Story } = defineMeta();
          </script>
        `,
      });

      const nodes = await extractModuleNodes({ module });

      expect(nodes.defineMetaImport.local.name).toBe('defineMeta');
    });

    it('ignores other named imports', async ({ expect }) => {
      const { module } = getSvelteAST({
        code: `
          <script module>
            import { composeStories } from "@storybook/svelte";
            import { defineMeta } from "@storybook/svelte";
            const { Story } = defineMeta();
          </script>
        `,
      });

      const nodes = await extractModuleNodes({ module });

      expect(nodes.defineMetaImport.local.name).toBe('defineMeta');
    });

    it('allows a namespace import next to a named defineMeta import', async ({ expect }) => {
      const { module } = getSvelteAST({
        code: `
          <script module>
            import * as SB from "@storybook/svelte";
            import { defineMeta } from "@storybook/svelte";
            const { Story } = defineMeta();
          </script>
        `,
      });

      const nodes = await extractModuleNodes({ module });

      expect(nodes.defineMetaImport.local.name).toBe('defineMeta');
    });

    it('fails with only a namespace import', async ({ expect }) => {
      const { module } = getSvelteAST({
        code: `
          <script module>
            import * as SB from "@storybook/svelte";
            const { Story } = SB.defineMeta();
          </script>
        `,
      });

      await expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
        [SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0002 (DefaultOrNamespaceImportUsedError): The file '<path not specified>'
        is using a default or namespace import of "@storybook/svelte-vite" or "@storybook/sveltekit",
        and doesn't import defineMeta by name. Import it with a named import, like so:

        import { defineMeta } from "@storybook/svelte-vite";

        In a SvelteKit project, import defineMeta from "@storybook/sveltekit".

        More info: https://github.com/storybookjs/storybook/blob/v<version>/code/renderers/svelte/src/svelte-csf/ERRORS.md#SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0002
        ]
      `);
    });
  });
});
