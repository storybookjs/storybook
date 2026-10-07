import type { CsfFile } from 'storybook/internal/csf-tools';

import { type E, type Node, identifierKey, walk } from '../../../csf-tools/estree/ast.ts';
import {
  SourceEditor,
  appendStatement,
  objectList,
  removeFromList,
} from '../../../csf-tools/estree/editor.ts';
import { SaveStoryError } from './utils.ts';

type In = ReturnType<CsfFile['parse']>;

// Append a copy of a story under a new name, without its `args`. Returns the new story's
// initializer.
export const duplicateStoryWithNewName = (csfFile: In, storyName: string, newStoryName: string) => {
  const node = csfFile._storyExports[storyName];
  if (node?.type !== 'VariableDeclarator' || !node.init) {
    throw new SaveStoryError(`cannot clone Node`);
  }
  const init = node.init as Node;

  const isCsf4Story =
    init.type === 'CallExpression' &&
    init.callee.type === 'MemberExpression' &&
    init.callee.property.type === 'Identifier' &&
    init.callee.property.name === 'story';

  // detect CSF2 and throw
  if (!isCsf4Story && (init.type === 'ArrowFunctionExpression' || init.type === 'CallExpression')) {
    throw new SaveStoryError(`Creating a new story based on a CSF2 story is not supported`);
  }

  // Copy the initializer without any `args`, which the caller fills in for the new story.
  const copy = new SourceEditor(`(${csfFile._editor.source(init)})`, csfFile._options.fileName);
  walk(copy.program, (child) => {
    if (child.type !== 'ObjectExpression') {
      return;
    }
    const args = child.properties.filter(
      (property): property is E.ObjectProperty =>
        property.type === 'Property' && !property.computed && identifierKey(property) === 'args'
    );
    if (args.length > 0) {
      removeFromList(copy, objectList(child), args);
    }
  });
  const initCode = copy.toString().slice(1, -1);
  const typeAnnotation =
    node.id.type === 'Identifier' && node.id.typeAnnotation
      ? csfFile._editor.source(node.id.typeAnnotation)
      : '';

  appendStatement(csfFile._editor, `export const ${newStoryName}${typeAnnotation} = ${initCode};`);
  csfFile._commit();

  const duplicated = csfFile._storyExports[newStoryName];
  return (duplicated?.type === 'VariableDeclarator' ? duplicated.init : duplicated) as Node;
};
