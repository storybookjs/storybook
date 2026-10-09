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

      defineMeta(...) or preview.meta(...) should be called inside a module script tag, like so:

      <script module>
        import { defineMeta } from "@storybook/svelte-vite";
        
        const { Story } = defineMeta({});
      </script>

      In a SvelteKit project, import defineMeta from "@storybook/sveltekit".
      With CSF factories, call preview.meta() in place of defineMeta(), with preview imported from '#.storybook/preview'.

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
      does not import defineMeta from "@storybook/svelte-vite" or "@storybook/sveltekit", or the preview from .storybook/preview, inside the module context.

      Make sure to import defineMeta from the package and use it inside the module context like so:

      <script module>
        import { defineMeta } from "@storybook/svelte-vite";
        
        const { Story } = defineMeta({});
      </script>

      In a SvelteKit project, import defineMeta from "@storybook/sveltekit".
      With CSF factories, call preview.meta() in place of defineMeta(), with preview imported from '#.storybook/preview'.

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
      does not store the result of calling defineMeta() or preview.meta(). While it might have been called,
      it's return value needs to be stored and destructured for the parsing to succeed, eg.:

      <script module>
        import { defineMeta } from "@storybook/svelte-vite";
        
        const { Story } = defineMeta({});
      </script>

      In a SvelteKit project, import defineMeta from "@storybook/sveltekit".
      With CSF factories, call preview.meta() in place of defineMeta(), with preview imported from '#.storybook/preview'.

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
      does not store the result of calling defineMeta() or preview.meta(). While it might have been called,
      it's return value needs to be stored and destructured for the parsing to succeed, eg.:

      <script module>
        import { defineMeta } from "@storybook/svelte-vite";
        
        const { Story } = defineMeta({});
      </script>

      In a SvelteKit project, import defineMeta from "@storybook/sveltekit".
      With CSF factories, call preview.meta() in place of defineMeta(), with preview imported from '#.storybook/preview'.

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

    expect(nodes.defineMetaVariableDeclaration.declarations[0].init).toMatchObject({
      callee: { name: 'defineMeta' },
    });
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

    expect(nodes.defineMetaVariableDeclaration.declarations[0].init).toMatchObject({
      callee: { name: 'dm' },
    });
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

      expect(nodes.defineMetaVariableDeclaration.declarations[0].init).toMatchObject({
        callee: { name: 'defineMeta' },
      });
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

      expect(nodes.defineMetaVariableDeclaration.declarations[0].init).toMatchObject({
        callee: { name: 'defineMeta' },
      });
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

      expect(nodes.defineMetaVariableDeclaration.declarations[0].init).toMatchObject({
        callee: { name: 'defineMeta' },
      });
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

      expect(nodes.defineMetaVariableDeclaration.declarations[0].init).toMatchObject({
        callee: { name: 'defineMeta' },
      });
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
  describe('CSF factories', () => {
    it('extracts the nodes of preview.meta()', async ({ expect }) => {
      const { module } = getSvelteAST({
        code: `
          <script module>
            import preview from '#.storybook/preview';
            const { Story } = preview.meta({});
          </script>
        `,
      });

      const nodes = await extractModuleNodes({ module });

      expect(nodes.isFactory).toBe(true);
      expect(nodes.metaIdentifier).toBeUndefined();
      expect(nodes.storyIdentifier.name).toBe('Story');
    });

    it('extracts the nodes of a meta variable', async ({ expect }) => {
      const { module } = getSvelteAST({
        code: `
          <script module>
            import preview from '#.storybook/preview';
            const meta = preview.meta({});
            const { Story: S } = meta;
          </script>
        `,
      });

      const nodes = await extractModuleNodes({ module });

      expect(nodes.isFactory).toBe(true);
      expect(nodes.metaIdentifier?.name).toBe('meta');
      expect(nodes.storyIdentifier.name).toBe('S');
    });

    it('fails when Story is not destructured from the meta', async ({ expect }) => {
      const { module } = getSvelteAST({
        code: `
          <script module>
            import preview from '#.storybook/preview';
            const meta = preview.meta({});
          </script>
        `,
      });

      await expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
        [SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0005 (NoStoryComponentDestructuredError): The file '<path not specified>'
        does not destructure the Story component from the 'preview.meta({ ... })' function call.
        eg.:

        <script module>
          import { defineMeta } from "@storybook/svelte-vite";
          
          const { Story } = defineMeta({});
        </script>

        In a SvelteKit project, import defineMeta from "@storybook/sveltekit".
        With CSF factories, call preview.meta() in place of defineMeta(), with preview imported from '#.storybook/preview'.

        More info: https://github.com/storybookjs/storybook/blob/v<version>/code/renderers/svelte/src/svelte-csf/ERRORS.md#SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0005
        ]
      `);
    });

    it('fails when a file calls defineMeta() and preview.meta()', async ({ expect }) => {
      const { module } = getSvelteAST({
        code: `
          <script module>
            import { defineMeta } from '@storybook/svelte';
            import preview from '#.storybook/preview';
            const { Story } = defineMeta({});
            const { Story: FactoryStory } = preview.meta({});
          </script>
        `,
      });

      await expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
        [SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0010 (MixedMetaError): The file '<path not specified>'
        calls both defineMeta() and preview.meta(). A stories file can only have one meta.
        Use preview.meta() for CSF factories, or defineMeta() otherwise.

        More info: https://github.com/storybookjs/storybook/blob/v<version>/code/renderers/svelte/src/svelte-csf/ERRORS.md#SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0010
        ]
      `);
    });

    it('fails when a file calls preview.meta() twice', async ({ expect }) => {
      const { module } = getSvelteAST({
        code: `
          <script module>
            import preview from '#.storybook/preview';
            const { Story } = preview.meta({});
            const meta = preview.meta({});
            const { Story: OtherStory } = meta;
          </script>
        `,
      });

      await expect(extractModuleNodes({ module })).rejects.toThrow(
        'SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0012'
      );
    });

    it('fails when preview is not imported from a preview file', async ({ expect }) => {
      const { module } = getSvelteAST({
        code: `
          <script module>
            import preview from '../storybook-config';
            const { Story } = preview.meta({});
          </script>
        `,
      });

      await expect(extractModuleNodes({ module })).rejects.toThrowErrorMatchingInlineSnapshot(`
        [SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0011 (PreviewNotImportedError): The file '<path not specified>'
        calls preview.meta(), but it doesn't import preview from the preview file of Storybook. Import it like so:

        <script module>
          import preview from '#.storybook/preview';

          const { Story } = preview.meta({});
        </script>

        The import path must end with '/preview', with or without a file extension.

        More info: https://github.com/storybookjs/storybook/blob/v<version>/code/renderers/svelte/src/svelte-csf/ERRORS.md#SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0011
        ]
      `);
    });

    it('ignores a .meta() call on another object', async ({ expect }) => {
      const { module } = getSvelteAST({
        code: `
          <script module>
            import { z } from 'zod';
            import preview from '#.storybook/preview';
            const schema = z.string().meta({});
            const { Story } = preview.meta({});
          </script>
        `,
      });

      const nodes = await extractModuleNodes({ module });

      expect(nodes.storyIdentifier.name).toBe('Story');
    });
  });
});
