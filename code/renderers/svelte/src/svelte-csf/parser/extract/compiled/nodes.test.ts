import { parseAst } from 'rollup/parseAst';
import { compile } from 'svelte/compiler';
import { describe, it } from 'vitest';

import { extractCompiledASTNodes } from './nodes.ts';

import { SVELTE_CSF_IMPORT_SOURCES } from '../../../constants.ts';

import { StorybookSvelteCSFError } from '../../../utils/error.ts';

function getCompiledAST(moduleScript: string) {
  const { js } = compile(
    `<script module>
      ${moduleScript}
    </script>

    <Story name="Default" />`,
    { filename: 'Example.stories.svelte' }
  );

  return parseAst(js.code);
}

describe(extractCompiledASTNodes.name, () => {
  it.for(SVELTE_CSF_IMPORT_SOURCES)(
    'finds defineMeta imported from %s',
    async (source, { expect }) => {
      const ast = getCompiledAST(`
      import { defineMeta } from '${source}';
      const { Story } = defineMeta({});
    `);

      const nodes = await extractCompiledASTNodes({ ast });

      expect(nodes.defineMetaImport.local.name).toBe('defineMeta');
    }
  );

  it('allows a namespace import of @storybook/svelte next to a named defineMeta import', async ({
    expect,
  }) => {
    const ast = getCompiledAST(`
      import * as SB from '@storybook/svelte';
      import { composeStories, defineMeta } from '@storybook/svelte';
      const { Story } = defineMeta({});
    `);

    const nodes = await extractCompiledASTNodes({ ast });

    expect(nodes.defineMetaImport.local.name).toBe('defineMeta');
  });

  it('fails with only a namespace import of @storybook/svelte', async ({ expect }) => {
    const ast = getCompiledAST(`
      import * as SB from '@storybook/svelte';
      const { Story } = SB.defineMeta({});
    `);

    await expect(extractCompiledASTNodes({ ast })).rejects.toThrowErrorMatchingInlineSnapshot(`
      [SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0002 (DefaultOrNamespaceImportUsedError): The file '<path not specified>'
      is using a default or namespace import of "@storybook/svelte-vite" or "@storybook/sveltekit",
      and doesn't import defineMeta by name. Import it with a named import, like so:

      import { defineMeta } from "@storybook/svelte-vite";

      In a SvelteKit project, import defineMeta from "@storybook/sveltekit".

      More info: https://github.com/storybookjs/storybook/blob/v${StorybookSvelteCSFError.packageVersion}/code/renderers/svelte/src/svelte-csf/ERRORS.md#SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0002
      ]
    `);
  });
});
