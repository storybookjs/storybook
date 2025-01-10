import { compile as mdxCompile, compileSync as mdxCompileSync } from '@mdx-js/mdx';

import type { CompileOptions, MdxCompileOptions } from './types';

export type { CompileOptions, MdxCompileOptions };

export const compile = async (input: string, { mdxCompileOptions = {} }: CompileOptions = {}) => {
  const options = getCompilerOptions(mdxCompileOptions);

  const mdxResult = await mdxCompile(input, options);

  return mdxResult.toString();
};

export const compileSync = (input: string, { mdxCompileOptions = {} }: CompileOptions = {}) => {
  const options = getCompilerOptions(mdxCompileOptions);

  const mdxResult = mdxCompileSync(input, options);

  return mdxResult.toString();
};

function getCompilerOptions(mdxCompileOptions: MdxCompileOptions): MdxCompileOptions {
  return {
    providerImportSource: '@mdx-js/react',
    rehypePlugins: [],
    ...mdxCompileOptions,
  };
}
