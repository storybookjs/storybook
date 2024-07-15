import { DefaultOrNamespaceImportUsedError } from '#utils/error/parser/extract/svelte';
import type { Identifier, ImportDeclaration } from 'estree';

interface Params {
  node: ImportDeclaration;
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
export function transformImportDeclaration(params: Params): ImportDeclaration {
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
    } satisfies Identifier;

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
