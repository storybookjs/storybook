import type { getStoriesIdentifiers } from '$lib/parser/analyse/story/attributes/identifiers.js';
import {
  type ESTreeAST,
  createASTArrayExpression,
  createASTExportSpecifier,
} from '$lib/parser/ast.js';

interface ExportOrderVariableDeclarationParams {
  storiesIdentifiers: ReturnType<typeof getStoriesIdentifiers>;
  filename?: string;
}

export function createExportOrderVariableDeclaration(
  params: ExportOrderVariableDeclarationParams
): ESTreeAST.ExportNamedDeclaration {
  const { storiesIdentifiers: storyIdentifiers } = params;

  const specifier = createASTExportSpecifier({ local: '__namedExportsOrder' });

  return {
    type: 'ExportNamedDeclaration',
    specifiers: [specifier],
    declaration: {
      type: 'VariableDeclaration',
      kind: 'const',
      declarations: [
        {
          type: 'VariableDeclarator',
          id: specifier.local as ESTreeAST.Identifier,
          init: createASTArrayExpression(
            storyIdentifiers.map(({ exportName }) => ({
              type: 'Literal',
              value: exportName,
            }))
          ),
        },
      ],
    },
  };
}
