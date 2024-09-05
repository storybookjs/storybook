import type { ESTreeAST } from '#parser/ast';

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
  exportMeta: ESTreeAST.ExportNamedDeclaration
): ESTreeAST.VariableDeclaration {
  const { declaration, leadingComments, start, end } = exportMeta;
  if (!declaration || declaration.type !== 'VariableDeclaration') {
    throw new Error(
      "Invalid syntax - 'export meta' declaration was empty or not a variable declaration"
    );
  }
  const { declarations } = declaration;
  const { init } = declarations[0];

  if (!init || init.type !== 'ObjectExpression') {
    throw new Error("Invalid syntax - 'export meta' init was empty or not an object expression");
  }

  const key = {
    type: 'Identifier',
    name: 'Story',
  } satisfies ESTreeAST.Identifier;

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
