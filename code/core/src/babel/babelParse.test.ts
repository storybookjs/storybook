import { describe, expect, it } from 'vitest';

import { babelParse } from './babelParse.ts';

describe('babelParse', () => {
  // Recast decides the parser's line terminator from `os.EOL` unless told otherwise, which would
  // make node offsets address a different source on Windows than everywhere else.
  it('reports node offsets into the source it was given', () => {
    const source = ['const a = 1;', 'const b = 2;', 'const c = 3;'].join('\n');

    const [, , third] = babelParse(source).program.body;

    expect(source.slice(third.start!, third.end!)).toBe('const c = 3;');
  });
});
