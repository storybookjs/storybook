import { logger } from 'storybook/internal/node-logger';
import { SVELTE_CSF_RENDERER_IMPORT_SOURCE } from '../../../constants.ts';
import { dedent } from 'ts-dedent';
import { print } from 'esrap';
import { parseAst } from 'rollup/parseAst';
import { compile } from 'svelte/compiler';
import { beforeEach, describe, it, vi } from 'vitest';

import { insertDefineMetaParameters } from './insert-parameters.ts';

import { getSvelteAST } from '../../../parser/ast.ts';
import { extractCompiledASTNodes } from '../../../parser/extract/compiled/nodes.ts';
import { extractSvelteASTNodes } from '../../../parser/extract/svelte/nodes.ts';
import { getDefineMetaFirstArgumentObjectExpression } from '../../../parser/extract/svelte/define-meta.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

describe(insertDefineMetaParameters.name, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('works when defineMeta gets an empty object', async ({ expect }) => {
    const code = dedent`
      <script module>
        import { defineMeta } from "${SVELTE_CSF_RENDERER_IMPORT_SOURCE}";

        /** Description of the component */
        const { Story } = defineMeta({});
      </script>

      <Story name="Default" />
    `;
    const svelteNodes = await extractSvelteASTNodes({ ast: getSvelteAST({ code }) });
    // NOTE: Rollup's parser returns a frozen array for the properties of an empty object literal
    const compiledNodes = await extractCompiledASTNodes({
      ast: parseAst(compile(code, { filename: 'Test.stories.svelte' }).js.code),
    });

    insertDefineMetaParameters({ nodes: { svelte: svelteNodes, compiled: compiledNodes } });

    const objectExpression = getDefineMetaFirstArgumentObjectExpression({ nodes: compiledNodes });

    expect(print(objectExpression).code).toMatchInlineSnapshot(`
      "{
      	parameters: {
      		docs: {
      			description: { component: "Description of the component" }
      		}
      	}
      }"
    `);
  });

  it('warns through the node logger when defineMeta parameters is not an object expression', async ({
    expect,
  }) => {
    const code = dedent`
      <script module>
        import { defineMeta } from "${SVELTE_CSF_RENDERER_IMPORT_SOURCE}";

        /** Description of the component */
        const { Story } = defineMeta({ parameters: 'not an object expression' });
      </script>

      <Story name="Default" />
    `;
    const svelteNodes = await extractSvelteASTNodes({ ast: getSvelteAST({ code }) });
    const compiledNodes = await extractCompiledASTNodes({
      ast: parseAst(compile(code, { filename: 'Test.stories.svelte' }).js.code),
    });

    expect(() =>
      insertDefineMetaParameters({ nodes: { svelte: svelteNodes, compiled: compiledNodes } })
    ).toThrow();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logger.warn).mock.calls[0][0]).toContain("Could not access 'parameters'");
  });
});
