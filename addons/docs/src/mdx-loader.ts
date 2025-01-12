import type { transformAsync } from '@babel/core';
import type { compile as mdxCompile } from '@mdx-js/mdx';

import { compile } from './compiler';

export type MdxCompileOptions = Parameters<typeof mdxCompile>[1];
export type BabelOptions = Parameters<typeof transformAsync>[1];

export interface CompileOptions {
  mdxCompileOptions?: MdxCompileOptions;
}

const DEFAULT_RENDERER = `
import React from 'react';
`; // Adjust this import based on your actual webpack version and typings

// Kind of like a mock so we don't have to install Webpack just for the types
type LoaderOptions = {
  filepath?: string;
  [key: string]: any;
} & any;

interface LoaderContext {
  async: () => (err: Error | null, result?: string) => void;
  getOptions: () => LoaderOptions;
  resourcePath: string;
}

async function loader(this: LoaderContext, content: string): Promise<void> {
  const callback = this.async();
  const options = { ...this.getOptions(), filepath: this.resourcePath };

  try {
    const result = await compile(content, options);
    const code = `${DEFAULT_RENDERER}\n${result}`;
    return callback(null, code);
  } catch (err: any) {
    console.error('Error loading:', this.resourcePath);
    return callback(err);
  }
}

export default loader;
