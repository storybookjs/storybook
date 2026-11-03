import type { getStoriesIdentifiers } from '../../../parser/analyse/story/attributes/identifiers.ts';
import {
  type ESTreeAST,
  createASTArrayExpression,
  createASTExportSpecifier,
} from '../../../parser/ast.ts';

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
    attributes: [],
  };
}
