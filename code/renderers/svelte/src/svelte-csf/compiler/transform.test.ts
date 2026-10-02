import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { parseAst } from 'rollup/parseAst';
import { compile } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

import { svelteCsfRuntimeStoriesPath, transformSvelteCsf } from './transform.ts';
import { SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE } from '../constants.ts';

const filename = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '../__tests__/stories/Example.stories.svelte'
);

describe(transformSvelteCsf.name, () => {
  it('turns a compiled stories file into a CSF module with one export per story', async () => {
    const compiledCode = compile(readFileSync(filename, 'utf8'), { filename }).js.code;

    const { code, map } = await transformSvelteCsf({
      filename,
      compiledCode,
      compiledAST: parseAst(compiledCode),
    });

    expect(code).toContain(`from "${SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE}"`);
    expect(code).toContain('export default $__meta;');
    expect(code).toContain('export const __namedExportsOrder = [');
    expect(map.sources).toEqual([filename]);
  });
});

describe('svelteCsfRuntimeStoriesPath', () => {
  it('is the file of the runtime stories module', () => {
    expect(path.isAbsolute(svelteCsfRuntimeStoriesPath)).toBe(true);
    expect(existsSync(svelteCsfRuntimeStoriesPath)).toBe(true);
  });
});
