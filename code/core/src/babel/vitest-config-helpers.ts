/**
 * Shared AST helpers for analyzing and determining whether a Vitest/Vite config file can be
 * auto-updated by Storybook. Extracted from the addon-vitest postinstall logic so the same
 * capability checks are used during `storybook init` (AddonVitestService) and during the actual
 * config update (updateVitestFile).
 */
import type * as t from '@babel/types';

import { babelParse } from './babelParse.ts';
import { resolveExpression } from './expression-resolver.ts';

type AST = t.File;

/**
 * Returns true if the identifier `localName` is a local alias for `defineConfig` or `defineProject`
 * imported from either `vitest/config` or `vite`.
 */
export const isImportedDefineConfigLikeIdentifier = (localName: string, ast: AST): boolean =>
  ast.program.body.some(
    (node): boolean =>
      node.type === 'ImportDeclaration' &&
      (node.source.value === 'vitest/config' || node.source.value === 'vite') &&
      node.specifiers.some(
        (specifier) =>
          specifier.type === 'ImportSpecifier' &&
          specifier.local.type === 'Identifier' &&
          specifier.local.name === localName &&
          specifier.imported.type === 'Identifier' &&
          (specifier.imported.name === 'defineConfig' ||
            specifier.imported.name === 'defineProject')
      )
  );

/** Returns true if a CallExpression is a call to defineConfig or defineProject (or an alias). */
export const isDefineConfigLike = (node: t.CallExpression, ast: AST): boolean =>
  node.callee.type === 'Identifier' &&
  (node.callee.name === 'defineConfig' ||
    node.callee.name === 'defineProject' ||
    isImportedDefineConfigLikeIdentifier(node.callee.name, ast));

/**
 * Resolves a `mergeConfig` argument to an ObjectExpression when possible. Handles:
 *
 * - Plain object literals: `{ test: {...} }`
 * - Variable references: `const vitestConfig = {...}; mergeConfig(viteConfig, vitestConfig)`
 * - Wrapped calls (e.g. `defineConfig({ ... })`): returns the inner ObjectExpression
 * - TypeScript type annotations: `mergeConfig(...) as ViteUserConfig`
 */
export const getConfigObjectFromMergeArg = (
  arg: t.Expression,
  ast: AST
): t.ObjectExpression | null => {
  const resolved = resolveExpression(arg, ast);
  if (!resolved) {
    return null;
  }

  if (resolved.type === 'ObjectExpression') {
    return resolved;
  }

  if (resolved.type === 'CallExpression' && resolved.arguments[0]?.type === 'ObjectExpression') {
    return resolved.arguments[0] as t.ObjectExpression;
  }

  return null;
};

/**
 * Extracts the effective `mergeConfig(...)` call from a declaration, unwrapping:
 *
 * - TypeScript type annotations (`as X`, `satisfies X`)
 * - `defineConfig(mergeConfig(...))` outer wrapper
 * - Variable references (`export default config` where `config = mergeConfig(...)`)
 *
 * Returns null when the declaration is not or does not contain a `mergeConfig` call.
 */
export const getEffectiveMergeConfigCall = (
  decl: t.Expression | t.Declaration,
  ast: AST
): t.CallExpression | null => {
  const resolved = resolveExpression(decl, ast);
  if (!resolved || resolved.type !== 'CallExpression') {
    return null;
  }

  // Handle defineConfig(mergeConfig(...)) – inner arg may itself be TS-wrapped
  if (isDefineConfigLike(resolved, ast) && resolved.arguments.length > 0) {
    const innerArg = resolveExpression(resolved.arguments[0] as t.Expression, ast);
    if (
      innerArg?.type === 'CallExpression' &&
      innerArg.callee.type === 'Identifier' &&
      innerArg.callee.name === 'mergeConfig'
    ) {
      return innerArg;
    }
  }

  // Handle mergeConfig(...) directly
  if (resolved.callee.type === 'Identifier' && resolved.callee.name === 'mergeConfig') {
    return resolved;
  }

  return null;
};

/**
 * Resolves the default export to the actual config ObjectExpression we can merge into. Handles:
 *
 * - `export default { ... }` — plain object
 * - `export default defineConfig({ ... })` — defineConfig with object
 * - `export default defineProject({ ... })` — defineProject with object
 * - `export default config` — variable reference to any of the above
 * - Any of the above wrapped in TypeScript type annotations
 *
 * Returns null when a writable ObjectExpression cannot be located.
 */
export const getTargetConfigObject = (
  target: AST,
  exportDefault: t.ExportDefaultDeclaration
): t.ObjectExpression | null => {
  const resolved = resolveExpression(exportDefault.declaration, target);
  if (!resolved) {
    return null;
  }
  if (resolved.type === 'ObjectExpression') {
    return resolved;
  }
  if (
    resolved.type === 'CallExpression' &&
    isDefineConfigLike(resolved, target) &&
    resolved.arguments[0]?.type === 'ObjectExpression'
  ) {
    return resolved.arguments[0] as t.ObjectExpression;
  }

  if (
    resolved.type === 'CallExpression' &&
    isDefineConfigLike(resolved, target) &&
    (resolved.arguments[0]?.type === 'ArrowFunctionExpression' ||
      resolved.arguments[0]?.type === 'FunctionExpression')
  ) {
    const callbackArg = resolved.arguments[0];

    // Support simple callbacks that directly return an object literal, e.g.
    // defineConfig(({ mode }) => ({ ... })) or defineConfig(function () { return { ... }; })
    if (callbackArg.body.type === 'ObjectExpression') {
      return callbackArg.body;
    }

    if (callbackArg.body.type === 'BlockStatement') {
      // Keep this conservative: only support callbacks that are exactly
      // `{ return { ... } }` with no additional control flow or statements.
      if (
        callbackArg.body.body.length === 1 &&
        callbackArg.body.body[0]?.type === 'ReturnStatement'
      ) {
        const returnedExpr = resolveExpression(callbackArg.body.body[0].argument, target);
        if (returnedExpr?.type === 'ObjectExpression') {
          return returnedExpr;
        }
      }
    }
  }

  return null;
};

/**
 * Returns `true` when a Vitest/Vite config file's default export uses a pattern that
 * `updateConfigFile` (from addon-vitest) can auto-update.
 *
 * Supported patterns:
 *
 * - `export default { test: {...} }`
 * - `export default defineConfig({ ... })` / `defineProject({ ... })`
 * - `export default mergeConfig(viteConfig, { ... })`
 * - `export default mergeConfig(viteConfig, defineConfig({ ... }))`
 * - `export default defineConfig(mergeConfig(...))`
 * - `export default config` (variable referencing any of the above)
 * - Any of the above wrapped in `as X` or `satisfies X` TypeScript annotations
 *
 * Unsupported patterns (returns `false`):
 *
 * - Callback-based defineConfig with non-literal/dynamic returns that cannot be safely resolved
 * - Completely unrecognizable export shapes
 * - No `export default` declaration at all
 */
export const canUpdateVitestConfigFile = (fileContent: string): boolean => {
  let parsedAst: AST;
  try {
    parsedAst = babelParse(fileContent);
  } catch {
    return false;
  }

  const exportDefault = parsedAst.program.body.find(
    (n): n is t.ExportDefaultDeclaration => n.type === 'ExportDefaultDeclaration'
  );
  if (!exportDefault) {
    return false;
  }

  return (
    getTargetConfigObject(parsedAst, exportDefault) !== null ||
    getEffectiveMergeConfigCall(exportDefault.declaration, parsedAst) !== null
  );
};

/**
 * Returns `true` when a Vitest workspace file's default export uses a pattern that
 * `updateWorkspaceFile` (from addon-vitest) can auto-update.
 *
 * Supported patterns:
 *
 * - `export default ["project1", "project2"]`
 * - `export default [{...}, "project"]`
 * - `export default defineWorkspace(["project1", "project2"])`
 *
 * Returns `false` for any other shape (e.g. JSON files should be rejected before parsing, CommonJS
 * files, unrecognizable exports).
 */
export const canUpdateVitestWorkspaceFile = (fileContent: string): boolean => {
  let parsedAst: AST;
  try {
    parsedAst = babelParse(fileContent);
  } catch {
    return false;
  }

  const exportDefault = parsedAst.program.body.find(
    (n): n is t.ExportDefaultDeclaration => n.type === 'ExportDefaultDeclaration'
  );
  if (!exportDefault) {
    return false;
  }

  const decl = exportDefault.declaration;

  // export default [...]
  if (decl.type === 'ArrayExpression') {
    return true;
  }

  // export default defineWorkspace([...])
  if (
    decl.type === 'CallExpression' &&
    decl.callee.type === 'Identifier' &&
    decl.callee.name === 'defineWorkspace' &&
    decl.arguments[0]?.type === 'ArrayExpression'
  ) {
    return true;
  }

  return false;
};
