// @ts-nocheck

const isNamed = (node, name) =>
  node?.type === 'MemberExpression' &&
  !node.computed &&
  node.property.type === 'Identifier' &&
  node.property.name === name;

const isGlobalMember = (node, object, property) =>
  isNamed(node, property) && node.object.type === 'Identifier' && node.object.name === object;

// Strips the wrappers that leave the value as it is: optional chains, `!` and TypeScript casts.
const unwrap = (node) => {
  let current = node;
  while (
    current?.type === 'ChainExpression' ||
    current?.type === 'TSNonNullExpression' ||
    current?.type === 'TSAsExpression' ||
    current?.type === 'TSSatisfiesExpression' ||
    current?.type === 'TSTypeAssertion'
  ) {
    current = current.expression;
  }
  return current;
};

const isSelf = (node) => {
  const current = unwrap(node);
  return isNamed(current, 'self') || (current?.type === 'Identifier' && current.name === 'self');
};

const findVariable = (scope, name) => {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(name);
    if (variable) {
      return variable;
    }
  }
  return undefined;
};

// True for service state or a part of it: a member chain through `self.state`, such as
// `ctx.self.state.components`, a local bound from one, such as `const { components } = ctx.self.state`,
// or a fallback such as `ctx.self.state.components ?? {}`. `throughMember` is true when `node` is the
// object of a member access, such as `snapshot` in `snapshot.components`.
const isServiceState = (node, getScope, seen = new Set(), throughMember = false) => {
  const current = unwrap(node);
  switch (current?.type) {
    case 'MemberExpression':
      return (
        (isNamed(current, 'state') && isSelf(current.object)) ||
        isServiceState(current.object, getScope, seen, true)
      );
    case 'LogicalExpression':
      return (
        isServiceState(current.left, getScope, seen, throughMember) ||
        isServiceState(current.right, getScope, seen, throughMember)
      );
    case 'ConditionalExpression':
      return (
        isServiceState(current.consequent, getScope, seen, throughMember) ||
        isServiceState(current.alternate, getScope, seen, throughMember)
      );
    case 'Identifier':
      return isBoundToServiceState(current, getScope, seen, throughMember);
    default:
      return false;
  }
};

// The keys from the root of a destructuring pattern down to `identifier`, such as
// `['self', 'state']` for `{ self: { state } }`, and whether it is a rest binding.
const patternBinding = (identifier) => {
  const path = [];
  let rest = false;
  let current = identifier;
  while (current.parent) {
    const { parent } = current;
    if (parent.type === 'AssignmentPattern' && parent.left === current) {
      current = parent;
    } else if (parent.type === 'Property' && parent.value === current) {
      if (parent.computed || parent.key.type !== 'Identifier') {
        return undefined;
      }
      path.unshift(parent.key.name);
      current = parent.parent;
    } else if (parent.type === 'RestElement') {
      rest = true;
      current = parent.parent;
    } else {
      break;
    }
  }
  return { path, rest };
};

const hasSelfState = (path) => path.some((key, i) => key === 'self' && path[i + 1] === 'state');

const isBoundToServiceState = (identifier, getScope, seen, throughMember) => {
  const def = findVariable(getScope(identifier), identifier.name)?.defs[0];
  const binding = def && patternBinding(def.name);
  // A rest binding is a shallow copy: making it reads every key through the tracked `ownKeys`, but
  // the records inside it are still state.
  if (!binding || (binding.rest && !throughMember)) {
    return false;
  }
  const { path } = binding;
  if (def.type === 'Parameter') {
    return hasSelfState(path);
  }
  const declarator = def.node;
  if (declarator?.type !== 'VariableDeclarator' || !declarator.init || seen.has(declarator)) {
    return false;
  }
  seen.add(declarator);
  return (
    hasSelfState(path) ||
    (path[0] === 'state' && isSelf(declarator.init)) ||
    isServiceState(declarator.init, getScope, seen)
  );
};

// The record that a call checks for an own key, or undefined when the call is not a key check.
const checkedRecord = (node) => {
  const { callee } = node;
  if (
    isGlobalMember(callee, 'Object', 'hasOwn') ||
    isGlobalMember(callee, 'Object', 'getOwnPropertyDescriptor') ||
    isGlobalMember(callee, 'Reflect', 'has') ||
    isGlobalMember(callee, 'Reflect', 'getOwnPropertyDescriptor') ||
    (callee.type === 'Identifier' && callee.name === 'hasOwn') ||
    (isNamed(callee, 'call') && isNamed(callee.object, 'hasOwnProperty'))
  ) {
    return node.arguments[0];
  }
  if (isNamed(callee, 'hasOwnProperty')) {
    return callee.object;
  }
  return undefined;
};

module.exports = {
  meta: {
    type: /** @type {const} */ ('problem'),
    docs: {
      description:
        'Disallow own-key checks on open-service state: the state proxy does not track them',
      category: 'Possible Errors',
      recommended: true,
      url: 'https://github.com/storybookjs/storybook/blob/next/code/core/src/shared/open-service/README.md',
    },
    messages: {
      untracked:
        'Service state does not track `in` or own-key checks, so a query handler or load that uses this check does not re-run when the key is added. Read the key instead: `getOwn(record, key)` from `open-service/plain-object.ts`, or `record[key] !== undefined`. To skip work that is already done, put the check in the command, not in the load.',
    },
    schema: [],
  },
  create(context) {
    const getScope = (node) => context.sourceCode.getScope(node);
    return {
      BinaryExpression(node) {
        if (node.operator === 'in' && isServiceState(node.right, getScope)) {
          context.report({ node, messageId: 'untracked' });
        }
      },
      CallExpression(node) {
        if (isServiceState(checkedRecord(node), getScope)) {
          context.report({ node, messageId: 'untracked' });
        }
      },
    };
  },
};
