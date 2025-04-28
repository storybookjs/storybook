import type { ESTreeAST } from '$lib/parser/ast.js';
import { DefaultOrNamespaceImportUsedError } from '$lib/utils/error/parser/extract/svelte.js';

interface Params {
  node: ESTreeAST.ImportDeclaration;
  filename?: string;
}

/**
 *
 * Codemod to transform AST node of {@link ImportDeclaration} specifiers.
 *
 * @example
 * ```diff
 * import {
 * - Story,
 * - Template,
 * + defineMeta,
 * } from "@storybook/addon-svelte-csf";
 * ```
 */
export function transformImportDeclaration(params: Params): ESTreeAST.ImportDeclaration {
  const { node, filename } = params;
  let { specifiers, ...rest } = node;

  let newSpecifiers: typeof specifiers = [];
  let hasDefineMeta = false;

  for (const specifier of specifiers) {
    if (specifier.type !== 'ImportSpecifier') {
      throw new DefaultOrNamespaceImportUsedError(filename);
    }

    if (specifier.imported.name === 'defineMeta') {
      newSpecifiers.push(specifier);
      hasDefineMeta = true;
    }
  }

  if (!hasDefineMeta) {
    const imported = {
      type: 'Identifier',
      name: 'defineMeta',
    } satisfies ESTreeAST.Identifier;

    newSpecifiers.push({
      type: 'ImportSpecifier',
      imported,
      local: imported,
    });
  }

  return {
    ...rest,
    specifiers: newSpecifiers,
  };
}
