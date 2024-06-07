import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import type { Program } from 'estree';
import { toJs } from 'estree-util-to-js';
import MagicString from 'magic-string';
import { parseAst } from 'rollup/parseAst';
import { describe, it } from 'vitest';

import { transformDefineMeta } from './index.js';

import { getSvelteAST } from '../../../parser/ast.js';
import { extractSvelteASTNodes } from '../../../parser/extract/svelte/nodes.js';
import { extractCompiledASTNodes } from '../../../parser/extract/compiled/nodes.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe(transformDefineMeta.name, () => {
  it("transformed 'defineMeta' matches inlined snapshot", async ({ expect }) => {
    const filename = path.resolve(__dirname, '../../../../stories/Example.stories.svelte');
    const originalCode = fs.readFileSync(filename).toString();
    const compiledPreTransformCode = fs
      .readFileSync(
        path.resolve(
          __dirname,
          '../../../../test/__compiled__/pre-transform/Example.stories.dev.js'
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

    expect(toJs(defineMetaVariableDeclaration as unknown as Program).value).toMatchInlineSnapshot(`
			"const {Story, meta} = defineMeta({
			  title: 'Example',
			  component: Example,
			  tags: ['autodocs'],
			  args: {
			    onclick: action("onclick"),
			    onmouseenter: action("onmouseenter"),
			    onmouseleave: action("onmouseleave")
			  },
			  parameters: {
			    docs: {
			      description: {
			        component: "Description set explicitly in the comment above \`defineMeta\`"
			      }
			    }
			  }
			});"
		`);
  });
});
