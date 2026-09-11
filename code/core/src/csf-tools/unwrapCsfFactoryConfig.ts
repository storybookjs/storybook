import { types as t } from 'storybook/internal/babel';

// Returns the innermost call rather than undefined when the config is not an inline object, so
// each caller keeps its own handling for a config it cannot resolve.
export function unwrapCsfFactoryConfig(node: t.Node | undefined): t.Node | undefined {
  let current = node;
  while (t.isCallExpression(current)) {
    if (t.isObjectExpression(current.arguments[0])) {
      return current.arguments[0];
    }
    if (t.isMemberExpression(current.callee) && t.isCallExpression(current.callee.object)) {
      current = current.callee.object;
    } else {
      break;
    }
  }
  return current;
}
