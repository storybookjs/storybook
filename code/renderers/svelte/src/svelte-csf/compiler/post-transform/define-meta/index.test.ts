import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { print } from 'esrap';
import ts from 'esrap/languages/ts';
import MagicString from 'magic-string';
import { parseAst } from 'rollup/parseAst';
import { compile } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

import { createMetaVariableDeclaration, transformDefineMeta } from './index.ts';

import { getSvelteAST } from '../../../parser/ast.ts';
import { extractSvelteASTNodes } from '../../../parser/extract/svelte/nodes.ts';
import { extractCompiledASTNodes } from '../../../parser/extract/compiled/nodes.ts';
import { insertDefineMetaParameters } from './insert-parameters.ts';
import { replaceDefineMetaArgument } from './replace-argument.ts';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe(transformDefineMeta.name, () => {
  it("transformed 'defineMeta' matches inlined snapshot", async () => {
    const filename = path.resolve(
      __dirname,
      '../../../../__test__/svelte-csf/example.stories.svelte'
    );
    const originalCode = fs.readFileSync(filename).toString();
    const compiledCode = compile(originalCode, { filename, dev: true }).js.code;
    const svelteAST = getSvelteAST({ code: originalCode, filename });
    const svelteASTNodes = await extractSvelteASTNodes({
      ast: svelteAST,
      filename,
    });
    const compiledASTNodes = await extractCompiledASTNodes({
      ast: parseAst(compiledCode),
      filename,
    });
    const code = new MagicString(compiledCode);

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

    expect(print(defineMetaVariableDeclaration, ts()).code).toMatchInlineSnapshot(
      `"const { Story } = defineMeta($__meta);"`
    );
  });
});

describe(createMetaVariableDeclaration.name, () => {
  it('parameters are transformed correctly', async () => {
    const filename = path.resolve(
      __dirname,
      '../../../../__test__/svelte-csf/example.stories.svelte'
    );
    const originalCode = fs.readFileSync(filename).toString();
    const compiledCode = compile(originalCode, { filename, dev: true }).js.code;
    const svelteAST = getSvelteAST({ code: originalCode, filename });
    const svelteASTNodes = await extractSvelteASTNodes({
      ast: svelteAST,
      filename,
    });
    const compiledASTNodes = await extractCompiledASTNodes({
      ast: parseAst(compiledCode),
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

    expect(print(metaVariableDeclaration, ts()).code).toMatchInlineSnapshot(`
      "const $__meta = {
      	title: 'Example',
      	component: Example,
      	tags: ['autodocs'],
      	args: { onclick: fn(), onmouseenter: fn(), onmouseleave: fn() },
      	parameters: {
      		docs: {
      			description: {
      				component: 'Description set explicitly in the comment above \`defineMeta\`.\\n\\nMultiline supported. And also Markdown syntax:\\n\\n* **Bold**,\\n* _Italic_,\\n* \`Code\`.'
      			}
      		}
      	}
      };"
    `);
  });
});
