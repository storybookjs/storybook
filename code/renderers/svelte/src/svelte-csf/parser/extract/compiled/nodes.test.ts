import { parseAst } from 'rollup/parseAst';
import { compile } from 'svelte/compiler';
import { describe, it } from 'vitest';

import { extractCompiledASTNodes } from './nodes.ts';

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
      is using the default/namespace import from "@storybook/svelte",
      and doesn't import defineMeta by name. Import it with a named import:
      import { defineMeta } from "@storybook/svelte";

      More info: https://github.com/storybookjs/storybook/blob/v${StorybookSvelteCSFError.packageVersion}/code/renderers/svelte/src/svelte-csf/ERRORS.md#SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0002
      ]
    `);
  });
});
