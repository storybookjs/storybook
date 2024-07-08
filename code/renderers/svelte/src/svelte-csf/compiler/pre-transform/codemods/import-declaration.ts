import type { Identifier, ImportDeclaration } from 'estree';
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
export function transformImportDeclaration(
  importDeclaration: ImportDeclaration
): ImportDeclaration {
  let { specifiers, ...rest } = importDeclaration;

  let newSpecifiers: typeof specifiers = [];
  let hasDefineMeta = false;

  for (const specifier of specifiers) {
    if (specifier.type !== 'ImportSpecifier') {
      // TODO: Update and document error message, this issue could exist in both legacy and new syntax
      throw new Error();
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
