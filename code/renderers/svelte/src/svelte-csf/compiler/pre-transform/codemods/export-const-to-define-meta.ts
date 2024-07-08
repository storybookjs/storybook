import type { ExportNamedDeclaration, Identifier, VariableDeclaration } from 'estree';

/**
 * Codemod to transform AST node of `export const meta` export named declaration to `defineMeta` variable declaration.
 *
 * @example
 * ```diff
 * - export const meta = {
 * + const { Story } = defineMeta({
 *     title: "Atom/Button",
 *     component: Button,
 *     args: {
 *         // ...
 *     },
 *     // .. and more
 * - } satisfies Meta<Button>;
 * + });
 * ```
 */
export function transformExportMetaToDefineMeta(
  exportMeta: ExportNamedDeclaration
): VariableDeclaration {
  const { declaration, leadingComments, start, end } = exportMeta;
  if (!declaration || declaration.type !== 'VariableDeclaration') {
    // WARN: This would happen if there was a syntax error, I don't think we should document this error.
    return undefined as never;
  }
  const { declarations } = declaration;
  const { init } = declarations[0];

  if (!init || init.type !== 'ObjectExpression') {
    // WARN: This would happen if there was a syntax error, I don't think we should document this error.
    return undefined as never;
  }

  const key = {
    type: 'Identifier',
    name: 'Story',
  } satisfies Identifier;

  return {
    type: 'VariableDeclaration',
    kind: 'const',
    declarations: [
      {
        type: 'VariableDeclarator',
        init: {
          type: 'CallExpression',
          callee: {
            type: 'Identifier',
            name: 'defineMeta',
          },
          arguments: [init],
          optional: false,
        },
        id: {
          type: 'ObjectPattern',
          properties: [
            {
              type: 'Property',
              kind: 'init',
              key,
              value: key,
              method: false,
              shorthand: true,
              computed: false,
            },
          ],
        },
      },
    ],
    leadingComments,
    start,
    end,
  };
}
