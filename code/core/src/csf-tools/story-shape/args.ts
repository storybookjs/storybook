import { type NodePath, types as t } from 'storybook/internal/babel';

import { keyOf } from './utils.ts';

/** Args object expression → record of arg name to its value AST node. */
export const argsRecordFromObjectPath = (
  objPath?: NodePath<t.ObjectExpression> | null
): Record<string, t.Node> => (objPath ? argsRecordFromObjectNode(objPath.node) : {});

/** Node-level variant of {@link argsRecordFromObjectPath}. */
export const argsRecordFromObjectNode = (
  obj?: t.ObjectExpression | null
): Record<string, t.Node> => {
  const result: Record<string, t.Node> = {};

  for (const property of obj?.properties ?? []) {
    if (!t.isObjectProperty(property)) {
      continue;
    }

    const key = keyOf(property);
    if (key) {
      result[key] = property.value;
    }
  }

  return result;
};

/** `args` record of a CSF meta object expression. */
export const metaArgsRecord = (meta?: t.ObjectExpression | null): Record<string, t.Node> => {
  if (!meta) {
    return {};
  }
  const argsProp = meta.properties.find(
    (p): p is t.ObjectProperty => t.isObjectProperty(p) && keyOf(p) === 'args'
  );
  return argsProp && t.isObjectExpression(argsProp.value)
    ? argsRecordFromObjectNode(argsProp.value)
    : {};
};

/**
 * `args` assigned to a story after its declaration, the CSF2 form `MyStory.args = { … }`.
 *
 * Assignment happens outside the story's own initializer, so it is invisible to anything that only
 * reads the declaration. Both `Story.args` and `Story['args']` are matched.
 */
export const storyAssignedArgsPath = (
  program: NodePath<t.Program>,
  storyName: string
): NodePath<t.ObjectExpression> | null => {
  let found: NodePath<t.ObjectExpression> | null = null;

  program.traverse({
    AssignmentExpression(assignment) {
      const left = assignment.get('left');
      const right = assignment.get('right');
      if (!left.isMemberExpression() || !right.isObjectExpression()) {
        return;
      }

      const object = left.get('object');
      const property = left.get('property');
      const isStory = object.isIdentifier() && object.node.name === storyName;
      const isArgs =
        (property.isIdentifier() && property.node.name === 'args' && !left.node.computed) ||
        (t.isStringLiteral(property.node) && left.node.computed && property.node.value === 'args');

      if (isStory && isArgs) {
        found = right;
      }
    },
  });

  return found;
};

/** CSF arg precedence: story args override meta args per key. */
export const mergeArgsRecords = (
  metaArgs: Record<string, t.Node>,
  storyArgs: Record<string, t.Node>
): Record<string, t.Node> => ({ ...metaArgs, ...storyArgs });
