import { SVELTE_CSF_RENDERER_IMPORT_SOURCE } from '../../../constants.ts';
import type { ESTreeAST } from '../../../parser/ast.ts';
import { DefaultOrNamespaceImportUsedError } from '../../../utils/error/parser/extract/svelte.ts';

interface Params {
  node: ESTreeAST.ImportDeclaration;
  filename?: string;
}

/**
 *
 * Codemod to transform AST node of {@link ImportDeclaration} specifiers,
 * and to import from the module that has `defineMeta`.
 *
 * @example
 * ```diff
 * import {
 * - Story,
 * - Template,
 * + defineMeta,
 * - } from "@storybook/svelte/csf";
 * + } from "@storybook/svelte";
 * ```
 */
export function transformImportDeclaration(params: Params): ESTreeAST.ImportDeclaration {
  const { node, filename } = params;
  const { specifiers } = node;

  const newSpecifiers: typeof specifiers = [];
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
    ...node,
    specifiers: newSpecifiers,
    source: {
      type: 'Literal',
      value: SVELTE_CSF_RENDERER_IMPORT_SOURCE,
    },
  };
}
