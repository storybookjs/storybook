import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { print } from 'esrap';
import MagicString from 'magic-string';
import { parseAst } from 'rollup/parseAst';
import { describe, it } from 'vitest';

import { createMetaVariableDeclaration, transformDefineMeta } from './index.ts';

import { getSvelteAST } from '../../../parser/ast.ts';
import { extractSvelteASTNodes } from '../../../parser/extract/svelte/nodes.ts';
import { extractCompiledASTNodes } from '../../../parser/extract/compiled/nodes.ts';
import { insertDefineMetaParameters } from './insert-parameters.ts';
import { replaceDefineMetaArgument } from './replace-argument.ts';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe(transformDefineMeta.name, () => {
  it("transformed 'defineMeta' matches inlined snapshot", async ({ expect }) => {
    const filename = path.resolve(__dirname, '../../../__tests__/stories/Example.stories.svelte');
    const originalCode = fs.readFileSync(filename).toString();
    const compiledPreTransformCode = fs
      .readFileSync(
        path.resolve(
          __dirname,
          '../../../__tests__/__compiled__/pre-transform/Example.stories.dev.js'
        )
      )
      .toString();
    const svelteAST = getSvelteAST({ code: originalCode, filename });
    const svelteASTNodes = await extractSvelteASTNodes({
      ast: svelteAST,
      filename,
    });
    const compiledASTNodes = await extractCompiledASTNodes({
      ast: parseAst(compiledPreTransformCode),
      filename,
    });
    const code = new MagicString(compiledPreTransformCode);

    transformDefineMeta({
      code,
      nodes: {
        svelte: svelteASTNodes,
        compiled: compiledASTNodes,
      },
      filename,
    });

    const { defineMetaVariableDeclaration } = await extractCompiledASTNodes({
      ast: parseAst(code.toString()),
    });

    expect(print(defineMetaVariableDeclaration).code).toMatchInlineSnapshot(
      `"const { Story } = defineMeta($__meta);"`
    );
  });
});

describe(createMetaVariableDeclaration.name, () => {
  it('parameters are transformed correctly', async ({ expect }) => {
    const filename = path.resolve(__dirname, '../../../__tests__/stories/Example.stories.svelte');
    const originalCode = fs.readFileSync(filename).toString();
    const compiledPreTransformCode = fs
      .readFileSync(
        path.resolve(
          __dirname,
          '../../../__tests__/__compiled__/pre-transform/Example.stories.dev.js'
        )
      )
      .toString();
    const svelteAST = getSvelteAST({ code: originalCode, filename });
    const svelteASTNodes = await extractSvelteASTNodes({
      ast: svelteAST,
      filename,
    });
    const compiledASTNodes = await extractCompiledASTNodes({
      ast: parseAst(compiledPreTransformCode),
      filename,
    });
    insertDefineMetaParameters({
      nodes: {
        svelte: svelteASTNodes,
        compiled: compiledASTNodes,
      },
      filename,
    });

    const metaObjectExpression = replaceDefineMetaArgument({
      nodes: {
        svelte: svelteASTNodes,
        compiled: compiledASTNodes,
      },
    });
    const metaVariableDeclaration = createMetaVariableDeclaration({ init: metaObjectExpression });

    expect(print(metaVariableDeclaration).code).toMatchInlineSnapshot(`
      "const $__meta = {
      	title: 'Example',
      	component: Example,
      	tags: ['autodocs'],
      	args: {
      		onclick: fn(),
      		onmouseenter: fn(),
      		onmouseleave: fn()
      	},
      	parameters: {
      		docs: {
      			description: {
      				component: "Description set explicitly in the comment above \`defineMeta\`.\\n\\nMultiline supported. And also Markdown syntax:\\n\\n* **Bold**,\\n* _Italic_,\\n* \`Code\`."
      			}
      		}
      	}
      };"
    `);
  });
});
