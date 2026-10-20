import { storyNameFromExport } from 'storybook/internal/csf/csf-utils';
import type { CsfFile } from 'storybook/internal/csf-tools';

import type { Node } from '../../../csf-tools/estree/ast.ts';
import { SaveStoryError, assertApplied, findStory } from './utils.ts';

// Adds `newStoryName` as a copy of `storyName`, without its own `name` and with its `args` emptied.
export const duplicateStoryWithNewName = (
  csf: CsfFile,
  storyName: string,
  newStoryName: string
) => {
  const node = csf._storyExports[storyName];
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

  const typeAnnotation =
    node.id.type === 'Identifier' && node.id.typeAnnotation
      ? csf.editor.source(node.id.typeAnnotation)
      : '';
  csf.appendStatement(
    `export const ${newStoryName}${typeAnnotation} = ${csf.editor.source(init)};`
  );
  csf.editor.commit();

  const copy = findStory(csf, newStoryName);
  if (copy.inspect(['name']).kind === 'value' && !copy.remove(['name']).ok) {
    // A spread before `name` would provide the copy's name instead.
    assertApplied(copy.set(['name'], storyNameFromExport(newStoryName)));
  }
  if (copy.inspect(['args']).kind === 'value') {
    assertApplied(copy.set(['args'], {}));
  }
};
