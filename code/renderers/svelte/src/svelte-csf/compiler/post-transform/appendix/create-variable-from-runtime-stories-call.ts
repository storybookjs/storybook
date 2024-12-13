import { createASTIdentifier, type ESTreeAST } from '#parser/ast';

interface Params {
  storiesFunctionDeclaration: ESTreeAST.FunctionDeclaration;
  filename?: string;
}

export function createVariableFromRuntimeStoriesCall(
  params: Params
): ESTreeAST.VariableDeclaration {
  const { storiesFunctionDeclaration } = params;

  return {
    type: 'VariableDeclaration',
    kind: 'const',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: {
          type: 'Identifier',
          name: '__stories',
        },
        init: {
          type: 'CallExpression',
          optional: false,
          callee: {
            type: 'Identifier',
            // WARN: Tempting to use `createRuntimeStories.name` here.
            // It will break, because this function imports `*.svelte` files.
            name: 'createRuntimeStories',
          },
          arguments: [
            {
              type: 'Identifier',
              name: storiesFunctionDeclaration.id.name,
            },
            createASTIdentifier('meta'),
          ],
        },
      },
    ],
  };
}
