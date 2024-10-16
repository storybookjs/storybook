import type { ESTreeAST } from '#parser/ast';
import { DefaultOrNamespaceImportUsedError } from '#utils/error/parser/extract/svelte';

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

    if (['defineMeta', 'setTemplate'].includes(specifier.imported.name)) {
      newSpecifiers.push(specifier);
      if (specifier.imported.name === 'defineMeta') hasDefineMeta = true;
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
