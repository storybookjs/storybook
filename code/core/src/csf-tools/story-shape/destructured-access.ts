// Where a name bound by an object pattern reads its value from: `const { args: { label } } = Primary`
// reads `Primary.args.label`, so the name resolves the way that member chain does.
import { type E, type Node, staticKey } from '../estree/ast.ts';
import type { Binding } from '../estree/scope.ts';

export interface DestructuredAccess {
  init: E.Expression;
  // Keys from `init` to the value the name binds, or to the object a rest element copies.
  path: string[];
  // For a rest element, the keys the other properties of its pattern take out of the copy.
  rest?: string[];
  // Where the destructuring runs, so the source is read as it is at that moment.
  position: number;
}

// Undefined when a step to the name is not a plain key: an array element, a default value or a
// computed key. Those name a value this pass cannot pin down.
export const destructuredAccess = (
  binding: Binding | undefined
): DestructuredAccess | undefined => {
  const declarator = binding?.node;
  if (
    !binding?.constant ||
    declarator?.type !== 'VariableDeclarator' ||
    declarator.id.type !== 'ObjectPattern' ||
    !declarator.init
  ) {
    return undefined;
  }
  const found = accessIn(declarator.id, binding.identifier, []);
  return found && { init: declarator.init, position: declarator.start, ...found };
};

const accessIn = (
  pattern: E.ObjectPattern,
  identifier: Node,
  path: string[]
): Pick<DestructuredAccess, 'path' | 'rest'> | undefined => {
  for (const property of pattern.properties) {
    if (property.type === 'RestElement') {
      if (property.argument !== identifier) {
        continue;
      }
      const rest = pattern.properties.flatMap((other) =>
        other.type === 'Property' ? [staticKey(other)] : []
      );
      return rest.every((key) => key !== undefined) ? { path, rest } : undefined;
    }
    const key = staticKey(property);
    if (key === undefined) {
      continue;
    }
    if (property.value === identifier) {
      return { path: [...path, key] };
    }
    if (property.value.type === 'ObjectPattern') {
      const found = accessIn(property.value, identifier, [...path, key]);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
};
