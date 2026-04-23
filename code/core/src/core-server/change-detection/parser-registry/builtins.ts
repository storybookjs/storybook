import { mdxParse } from './mdx-parse.ts';
import { oxcParse } from './oxc-parse.ts';
import type { ImportParser } from './types.ts';

/** Default parser for JavaScript/TypeScript source. Uses `oxc-parser` under the hood. */
export const oxcImportParser: ImportParser = {
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  async parse({ filePath, source }) {
    return oxcParse(filePath, source);
  },
};

/** Default parser for MDX files. Uses a regex fallback (oxc-parser cannot parse MDX). */
export const mdxImportParser: ImportParser = {
  extensions: ['.mdx'],
  async parse({ source }) {
    return mdxParse(source);
  },
};

/**
 * Built-in parsers shipped with core change-detection. These cover the extensions the
 * previous {@link ImportExtractor} handled directly; additional extensions (e.g. `.vue`,
 * `.svelte`) are contributed by framework/renderer plugins via the
 * `experimental_importParsers` preset key.
 */
export const builtinImportParsers: readonly ImportParser[] = [oxcImportParser, mdxImportParser];
