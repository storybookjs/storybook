import { RUNTIME_STORIES_IDENTIFIER, STORYBOOK_META_IDENTIFIER } from '../../../constants.ts';
import { createASTIdentifier, type ESTreeAST } from '../../../parser/ast.ts';

interface Params {
  storiesFunctionDeclaration: ESTreeAST.FunctionDeclaration;
  // The meta of a CSF factories file. Its annotations are in `meta.input`.
  factoryMeta?: ESTreeAST.Identifier;
  filename?: string;
}

export function createVariableFromRuntimeStoriesCall(
  params: Params
): ESTreeAST.VariableDeclaration {
  const { storiesFunctionDeclaration, factoryMeta } = params;

  return {
    type: 'VariableDeclaration',
    kind: 'const',
    start: 0,
    end: 0,
    declarations: [
      {
        type: 'VariableDeclarator',
        start: 0,
        end: 0,
        id: createASTIdentifier(RUNTIME_STORIES_IDENTIFIER),
        init: {
          type: 'CallExpression',
          optional: false,
          start: 0,
          end: 0,
          // WARN: Tempting to use `createRuntimeStories.name` here.
          // It will break, because this function imports `*.svelte` files.
          callee: createASTIdentifier('createRuntimeStories'),
          arguments: [
            createASTIdentifier(storiesFunctionDeclaration.id.name),
            factoryMeta
              ? {
                  type: 'MemberExpression',
                  computed: false,
                  optional: false,
                  start: 0,
                  end: 0,
                  object: factoryMeta,
                  property: createASTIdentifier('input'),
                }
              : createASTIdentifier(STORYBOOK_META_IDENTIFIER),
          ],
        },
      },
    ],
  };
}
