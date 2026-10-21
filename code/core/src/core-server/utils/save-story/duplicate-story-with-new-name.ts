import { storyNameFromExport } from 'storybook/internal/csf/csf-utils';
import type { CsfFile, CsfMutationResult } from 'storybook/internal/csf-tools';

import { type Node, unwrapExpression } from '../../../csf-tools/estree/ast.ts';
import { SaveStoryError, assertApplied, findStory } from './utils.ts';

// Adds `newStoryName` as a copy of `storyName`, without its own `name` and with its `args` emptied.
export const duplicateStoryWithNewName = (
  csf: CsfFile,
  storyName: string,
  newStoryName: string
) => {
  if (csf.editor.scopes.program.bindings.has(newStoryName)) {
    throw new SaveStoryError(
      `Cannot create story ${newStoryName} because the file already uses the name ${newStoryName}. Choose another name.`
    );
  }
  // A copy of `export const Secondary = Primary` would be another name for Primary too.
  const source = csf.storyObject(storyName);
  if (source?.ok === false && source.diagnostic.code === 'aliased-story') {
    const original = source.diagnostic.aliasOf;
    throw new SaveStoryError(
      original
        ? `Cannot create a story from ${storyName} because it is the same story as ${original}. Create the new story from ${original} instead.`
        : `Cannot create a story from ${storyName} because it is another name for a story in this file. Create the new story from that story instead.`
    );
  }
  // A story without an editor, such as `export const A = makeStory()`, still names its binding.
  const target = source?.ok ? source.object.target : source?.diagnostic.target;
  const node =
    target?.kind === 'story'
      ? csf.editor.scopes.program.bindings.get(target.localName)?.node
      : undefined;
  if (node?.type !== 'VariableDeclarator' || !node.init) {
    throw new SaveStoryError(`cannot clone Node`);
  }
  const init = node.init as Node;
  // `as` and `satisfies` stay on the copy, but do not hide a CSF2 story from the check.
  const story = unwrapExpression(init);

  // A factory story, such as `meta.story({})` or `Primary.extend({})`, is a call too.
  if (
    !csf.stories.find(({ exportName }) => exportName === storyName)?.factory &&
    (story.type === 'ArrowFunctionExpression' || story.type === 'CallExpression')
  ) {
    throw new SaveStoryError(`Creating a new story based on a CSF2 story is not supported`);
  }

  const typeAnnotation =
    node.id.type === 'Identifier' && node.id.typeAnnotation
      ? csf.editor.source(node.id.typeAnnotation)
      : '';
  // Tried in a transaction of its own, so that a refusal does not roll back the copy.
  const attempt = (mutation: () => CsfMutationResult) => csf.transaction(() => mutation().ok);

  // A refusal after the copy is added takes the copy back too, so the file stays as it was.
  csf.transaction(() => {
    csf.appendStatement(
      `export const ${newStoryName}${typeAnnotation} = ${csf.editor.source(init)};`
    );
    csf.editor.commit();

    const copy = findStory(csf, newStoryName);
    // Without a `name` of its own, the copy shows the name its export gives. When a spread provides
    // the name, or could, set that name after it; when a later spread could override it, leave it.
    const name = copy.inspect(['name']);
    if (
      name.kind !== 'missing' &&
      !(name.kind === 'value' && attempt(() => copy.remove(['name'])))
    ) {
      attempt(() => copy.set(['name'], storyNameFromExport(newStoryName)));
    }
    if (copy.inspect(['args']).kind === 'value') {
      assertApplied(newStoryName, copy.set(['args'], {}));
    }
  });
};
