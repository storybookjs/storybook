import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import MagicString from 'magic-string';
import { parseAst } from 'rollup/parseAst';
import { describe, it } from 'vitest';

import { removeExportDefault } from './remove-export-default';

import { extractCompiledASTNodes } from '#parser/extract/compiled/nodes';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe(removeExportDefault.name, () => {
  it('removes pre-transformed export default correctly', async ({ expect }) => {
    const compiledPreTransformCode = fs
      .readFileSync(
        path.resolve(__dirname, '../../../tests/__compiled__/pre-transform/Example.stories.dev.js')
      )
      .toString();
    const compiledASTNodes = await extractCompiledASTNodes({
      ast: parseAst(compiledPreTransformCode),
    });
    const code = new MagicString(compiledPreTransformCode);
    removeExportDefault({
      code,
      nodes: compiledASTNodes,
    });

    expect(
      extractCompiledASTNodes({
        ast: parseAst(code.toString()),
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_0003 (NoExportDefaultError): Could not find 'export default' in the compiled output of the stories file: <path not specified>]`
    );
  });
});
