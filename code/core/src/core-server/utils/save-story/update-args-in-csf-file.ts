import type { CsfFile } from 'storybook/internal/csf-tools';

import { type E, type Node, identifierKey, walk } from '../../../csf-tools/estree/ast.ts';
import { appendMembers, prependMembers, replaceValue } from '../../../csf-tools/estree/editor.ts';
import { SaveStoryError } from './utils.ts';
import { objectSource, valueToSource } from './valueToSource.ts';

// Write `input` into the `args` of a story. Edits accumulate on the file; print them with
// `printCsf`.
export const updateArgsInCsfFile = async (csf: CsfFile, node: Node, input: Record<string, any>) => {
  const editor = csf._editor;
  const args = Object.fromEntries(
    Object.entries(input).map(([k, v]) => [k, valueToSource(v, editor.quote)])
  );

  const isCsf4Story =
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'story';

  // detect CSF2 and throw
  if (!isCsf4Story && (node.type === 'ArrowFunctionExpression' || node.type === 'CallExpression')) {
    throw new SaveStoryError(`Updating a CSF2 story is not supported`);
  }

  // The story object itself, or the first object inside it (e.g. the `meta.story({ … })` argument).
  let story: E.ObjectExpression | undefined;
  walk(node, (child) => {
    if (story) {
      return false;
    }
    if (child.type === 'ObjectExpression') {
      story = child;
      return false;
    }
  });
  if (!story) {
    return;
  }

  const argsProperty = story.properties.find(
    (property): property is E.ObjectProperty =>
      property.type === 'Property' && !property.computed && identifierKey(property) === 'args'
  );

  if (!argsProperty) {
    prependMembers(editor, story, [
      `args: ${objectSource(Object.entries(args).map(([key, value]) => `${key}: ${value}`))}`,
    ]);
    return;
  }

  if (argsProperty.value.type !== 'ObjectExpression') {
    return;
  }
  for (const property of argsProperty.value.properties) {
    const key =
      property.type === 'Property' && !property.computed ? identifierKey(property) : undefined;
    if (property.type === 'Property' && key && key in args) {
      replaceValue(editor, property, args[key]);
      delete args[key];
    }
  }

  const remainder = Object.entries(args);
  if (remainder.length > 0) {
    appendMembers(
      editor,
      argsProperty.value,
      remainder.map(([key, value]) => `${key}: ${value}`)
    );
  }
};
