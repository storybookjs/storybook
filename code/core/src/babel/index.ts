/**
 * This entry is to ensure we use a single version of Babel across the codebase. This is to prevent
 * issues with multiple versions of Babel being used in the same project. It also prevents us from
 * bundling babel multiple times in the final bundles.
 *
 * `types` and `parser` are namespace imports because consumers use them in type positions
 * (`t.Node`), which a lazily resolved value cannot satisfy. Everything only used as a value is
 * bundled but resolved on first access (see `shared/utils/lazy-require.ts`), so a process that
 * never parses does not evaluate `@babel/core`, `@babel/traverse`, `@babel/generator` or recast.
 */
import type * as BabelCore from '@babel/core';
import type BabelGenerator from '@babel/generator';
import * as parser from '@babel/parser';
import type BabelTraverse from '@babel/traverse';
import * as types from '@babel/types';
import type * as Recast from 'recast';

import { lazyFunction, lazyModule } from '../shared/utils/lazy-require.ts';

export * from './babelParse.ts';
export { unwrapTSExpression, resolveExpression } from './expression-resolver.ts';
export {
  isImportedDefineConfigLikeIdentifier,
  isDefineConfigLike,
  getConfigObjectFromMergeArg,
  getEffectiveMergeConfigCall,
  getTargetConfigObject,
  canUpdateVitestConfigFile,
  canUpdateVitestWorkspaceFile,
} from './vitest-config-helpers.ts';

const core: typeof BabelCore = lazyModule(() => require('@babel/core'));
const recast: typeof Recast = lazyModule(() => require('recast'));

// `@babel/traverse` and `@babel/generator` are CJS packages that put their function on
// `exports.default`.
const traverse: typeof BabelTraverse = lazyFunction(() => {
  const bt = require('@babel/traverse');
  return bt.default || bt;
});
const generate: typeof BabelGenerator = lazyFunction(() => {
  const bg = require('@babel/generator');
  return bg.default || bg;
});
const transformSync: typeof BabelCore.transformSync = lazyFunction(
  () => require('@babel/core').transformSync
);

// `File` is not yet exposed in @babel/core's types, see
// https://github.com/babel/babel/issues/11350#issuecomment-644118606
const BabelFileClass: any = lazyFunction(() => require('@babel/core').File);

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
