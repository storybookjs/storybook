import { RUNTIME_STORIES_IDENTIFIER, STORYBOOK_META_IDENTIFIER } from '$lib/constants.js';
import { createASTIdentifier, type ESTreeAST } from '$lib/parser/ast.js';

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
        id: createASTIdentifier(RUNTIME_STORIES_IDENTIFIER),
        init: {
          type: 'CallExpression',
          optional: false,
          // WARN: Tempting to use `createRuntimeStories.name` here.
          // It will break, because this function imports `*.svelte` files.
          callee: createASTIdentifier('createRuntimeStories'),
          arguments: [
            createASTIdentifier(storiesFunctionDeclaration.id.name),
            createASTIdentifier(STORYBOOK_META_IDENTIFIER),
          ],
        },
      },
    ],
  };
}
