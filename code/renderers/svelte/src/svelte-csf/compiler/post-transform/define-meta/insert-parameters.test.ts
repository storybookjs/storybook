import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import dedent from 'dedent';
import { print } from 'esrap';
import { parseAst } from 'rollup/parseAst';
import { compile } from 'svelte/compiler';
import { describe, it } from 'vitest';

import { insertDefineMetaParameters } from './insert-parameters.js';

import { getSvelteAST } from '$lib/parser/ast.js';
import { extractCompiledASTNodes } from '$lib/parser/extract/compiled/nodes.js';
import { extractSvelteASTNodes } from '$lib/parser/extract/svelte/nodes.js';
import { getDefineMetaFirstArgumentObjectExpression } from '$lib/parser/extract/svelte/define-meta.js';

describe(insertDefineMetaParameters.name, () => {
  it('works when defineMeta gets an empty object', async ({ expect }) => {
    const code = dedent`
      <script module>
        import { defineMeta } from "${pkg.name}";

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
});
