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

/** CSF arg precedence: story args override meta args per key. */
export const mergeArgsRecords = (
  metaArgs: Record<string, t.Node>,
  storyArgs: Record<string, t.Node>
): Record<string, t.Node> => ({ ...metaArgs, ...storyArgs });
