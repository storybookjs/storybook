import type { compile as mdxCompile } from '@mdx-js/mdx';

export type MdxCompileOptions = Parameters<typeof mdxCompile>[1];

export interface CompileOptions {
  mdxCompileOptions?: MdxCompileOptions;
}
