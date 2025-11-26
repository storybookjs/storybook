/**
 * This entry is to ensure we use a single version of Babel across the codebase. This is to prevent
 * issues with multiple versions of Babel being used in the same project. It also prevents us from
 * bundling babel multiple times in the final bundles.
 */
import { transformSync } from '@babel/core';
import * as core from '@babel/core';
// @ts-expect-error File is not yet exposed, see https://github.com/babel/babel/issues/11350#issuecomment-644118606
import { File } from '@babel/core';
import bg from '@babel/generator';
import * as parser from '@babel/parser';
import bt from '@babel/traverse';
import * as types from '@babel/types';
import * as recast from 'recast';

export * from './babelParse';

// @ts-expect-error (needed due to it's use of `exports.default`)
const traverse = (bt.default || bt) as typeof bt;
// @ts-expect-error (needed due to it's use of `exports.default`)
const generate = (bg.default || bg) as typeof bg;

const BabelFileClass = File as any;

export {
  // main
  core,
  generate,
  traverse,
  types,
  parser,
  transformSync,
  BabelFileClass,

  // other
  recast,
};

export type { BabelFile, NodePath } from '@babel/core';
export type { GeneratorOptions } from '@babel/generator';
export type { Options as RecastOptions } from 'recast';
