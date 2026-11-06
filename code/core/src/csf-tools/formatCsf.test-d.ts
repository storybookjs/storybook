import { expectTypeOf, test } from 'vitest';

import { type CsfFile, type CsfSourceMap, type FormatCsfOptions, formatCsf } from './CsfFile.ts';

declare const csf: CsfFile;
declare const sourceMaps: boolean;
declare const options: FormatCsfOptions;

test('returns the code and its map with sourceMaps: true', () => {
  expectTypeOf(
    formatCsf(csf, { sourceMaps: true, sourceFileName: 'Button.stories.ts' })
  ).toEqualTypeOf<{
    code: string;
    map: CsfSourceMap;
  }>();
  expectTypeOf(formatCsf(csf, { ...options, sourceMaps: true })).toEqualTypeOf<{
    code: string;
    map: CsfSourceMap;
  }>();
});

test('returns the code alone without sourceMaps', () => {
  expectTypeOf(formatCsf(csf)).toEqualTypeOf<string>();
  expectTypeOf(formatCsf(csf, {})).toEqualTypeOf<string>();
  expectTypeOf(formatCsf(csf, { sourceMaps: false })).toEqualTypeOf<string>();
});

test('returns either when sourceMaps is only known at runtime', () => {
  expectTypeOf(formatCsf(csf, { sourceMaps })).toEqualTypeOf<
    { code: string; map: CsfSourceMap } | string
  >();
  expectTypeOf(formatCsf(csf, options)).toEqualTypeOf<
    { code: string; map: CsfSourceMap } | string
  >();
});
