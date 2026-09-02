/**
 * This entry is to ensure we use a single version of Babel across the codebase. This is to prevent
 * issues with multiple versions of Babel being used in the same project. It also prevents us from
 * bundling babel multiple times in the final bundles.
 *
 * `types` and `parser` are namespace imports because consumers use them in type positions
 * (`t.Node`). The transform packages are only ever called, so they are resolved inside the wrapper
 * on first call: every `storybook` command evaluates this entry through `common` and `core-server`,
 * and most never parse or print anything.
 */
import type { BabelFile, BabelFileResult, TransformOptions } from '@babel/core';
import type { GeneratorOptions, GeneratorResult } from '@babel/generator';
import * as parser from '@babel/parser';
import type { NodePath, Scope, TraverseOptions } from '@babel/traverse';
import * as types from '@babel/types';

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

export { types, parser };

export function traverse<S>(
  parent: types.Node,
  opts: TraverseOptions<S>,
  scope: Scope | undefined,
  state: S,
  parentPath?: NodePath
): void;
export function traverse(
  parent: types.Node,
  opts?: TraverseOptions,
  scope?: Scope,
  state?: unknown,
  parentPath?: NodePath
): void;
export function traverse(...args: unknown[]): void {
  // A CJS package that puts its function on `exports.default`.
  const bt = require('@babel/traverse');
  return (bt.default || bt)(...args);
}

export function generate(
  ast: types.Node,
  opts?: GeneratorOptions,
  code?: string | { [filename: string]: string }
): GeneratorResult {
  const bg = require('@babel/generator');
  return (bg.default || bg)(ast, opts, code);
}

export function transformSync(code: string, opts?: TransformOptions): BabelFileResult | null {
  return require('@babel/core').transformSync(code, opts);
}

/**
 * A `BabelFile` around already-parsed code, the object babel plugins and `path.traverse` operate
 * on. `File` is not yet exposed in @babel/core's types, see
 * https://github.com/babel/babel/issues/11350#issuecomment-644118606
 */
export function createBabelFile(
  options: { filename?: string; highlightCode?: boolean },
  input: { code: string; ast?: types.File }
): BabelFile {
  const { File } = require('@babel/core');
  return new File(options, input);
}

export type { BabelFile, NodePath } from '@babel/core';
export type { GeneratorOptions } from '@babel/generator';
export type { Options as RecastOptions } from 'recast';
