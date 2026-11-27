import type { ConfigFile } from './ConfigFile.ts';
import { exportedName, isModuleExports } from './ConfigObject.ts';
import type { CsfPath } from './CsfObjectPath.ts';
import {
  type E,
  type Node,
  isStringLiteral,
  staticKey,
  unwrapExpression,
  withoutTypeCalls,
} from './estree/ast.ts';
import { resolveExpression } from './estree/values.ts';

/**
 * Known keys, in the order they first appear. For each property with an unresolved key, `computed`
 * contains the keys of its value, or `undefined` if they cannot be read. `external` means an
 * unresolved spread may add or override keys.
 */
export type CsfKeys = { keys: string[]; computed: (CsfKeys | undefined)[]; external: boolean };

type Shape = { members: Map<string, E.ObjectProperty>; computed: Node[]; external: boolean };

const memberKey = (member: E.MemberExpression) => {
  if (!member.computed) {
    return member.property.type === 'Identifier' ? member.property.name : undefined;
  }
  return isStringLiteral(member.property) ? member.property.value : undefined;
};

export const getConfigKeys = (config: ConfigFile, path: CsfPath): CsfKeys | undefined => {
  const { editor } = config;
  const { scopes } = editor;

  const resolvingValues = new Set<Node>();
  const collectingMembers = new Set<Node>();
  const listingKeys = new Set<Node>();

  const cachedShapes = new Map<Node, Shape>();

  const resolveDeclaredValue = (node: Node | null | undefined): Node | undefined => {
    const entered: Node[] = [];
    const enter = (value: Node) => {
      resolvingValues.add(value);
      entered.push(value);
    };
    try {
      let value = unwrapExpression(node ?? undefined);
      for (;;) {
        if (!value || resolvingValues.has(value)) {
          return undefined;
        }
        if (value.type === 'Identifier') {
          // Read the initializer even if the variable is reassigned. The editor checks whether it
          // can be changed.
          const declarator = scopes.bindingOf(value)?.node;
          const init =
            declarator?.type === 'VariableDeclarator' && declarator.id.type === 'Identifier'
              ? declarator.init
              : undefined;
          if (!init) {
            return undefined;
          }
          enter(value);
          value = unwrapExpression(init);
        } else if (value.type === 'MemberExpression') {
          const key = memberKey(value);
          if (key === undefined) {
            return undefined;
          }
          enter(value);
          const owner = resolveObject(value.object);
          const propertyValue = owner && shapeOf(owner).members.get(key)?.value;
          if (!propertyValue) {
            return undefined;
          }
          value = unwrapExpression(propertyValue);
        } else {
          return value;
        }
      }
    } finally {
      for (const value of entered) {
        resolvingValues.delete(value);
      }
    }
  };

  const resolveObject = (node: Node | null | undefined) => {
    const value = resolveDeclaredValue(node);
    return value?.type === 'ObjectExpression' ? value : undefined;
  };

  const resolveConfigObject = (node: Node | null | undefined) => {
    let value = resolveDeclaredValue(node);
    const calls = new Set<Node>();
    while (value?.type === 'CallExpression' && !calls.has(value)) {
      calls.add(value);
      const receiver = withoutTypeCalls(value);
      value = resolveDeclaredValue(receiver === value ? value.arguments[0] : receiver);
    }
    return value?.type === 'ObjectExpression' ? value : undefined;
  };

  const keyOf = (property: E.ObjectProperty): string | undefined => {
    const name = staticKey(property);
    if (name !== undefined) {
      return name;
    }
    const key = property.computed
      ? resolveExpression(scopes, property.key, 'read')
      : (property.key as Node);
    if (key?.type === 'Literal') {
      return 'bigint' in key && typeof key.bigint === 'string'
        ? String(BigInt(key.bigint))
        : String(key.value ?? key.raw);
    }
    return key ? staticKey({ ...property, key } as E.ObjectProperty) : undefined;
  };

  const shapeOf = (object: E.ObjectExpression): Shape => {
    const known = cachedShapes.get(object);
    if (known) {
      return known;
    }
    const shape: Shape = { members: new Map(), computed: [], external: false };
    if (collectingMembers.has(object)) {
      shape.external = true;
      return shape;
    }
    collectingMembers.add(object);
    for (const property of object.properties) {
      if (property.type === 'SpreadElement') {
        const spread = resolveObject(property.argument);
        if (!spread) {
          shape.external = true;
          continue;
        }
        const inner = shapeOf(spread);
        for (const [key, member] of inner.members) {
          shape.members.set(key, member);
        }
        shape.computed.push(...inner.computed);
        shape.external ||= inner.external;
      } else {
        const key = keyOf(property);
        if (key === undefined) {
          shape.computed.push(property.value);
        } else {
          shape.members.set(key, property);
        }
      }
    }
    collectingMembers.delete(object);
    cachedShapes.set(object, shape);
    return shape;
  };

  const keysOf = (object: E.ObjectExpression): CsfKeys | undefined => {
    if (listingKeys.has(object)) {
      return undefined;
    }
    listingKeys.add(object);
    const shape = shapeOf(object);
    const computed = shape.computed.map((value) => {
      const held = resolveObject(value);
      return held && keysOf(held);
    });
    listingKeys.delete(object);
    return { keys: [...shape.members.keys()], computed, external: shape.external };
  };

  let defaultExport: Node | undefined;
  const namedExports = new Map<string, Node | null | undefined>();
  for (const statement of editor.program.body) {
    if (statement.type === 'ExportDefaultDeclaration') {
      defaultExport = statement.declaration as Node;
    } else if (statement.type === 'ExportNamedDeclaration' && !statement.source) {
      if (statement.declaration?.type === 'VariableDeclaration') {
        for (const { id, init } of statement.declaration.declarations) {
          if (id.type === 'Identifier') {
            namedExports.set(id.name, init);
          }
        }
      }
      for (const { exported, local } of statement.specifiers) {
        if (exportedName(exported) === 'default') {
          defaultExport = local as Node;
        } else {
          namedExports.set(exportedName(exported), local as Node);
        }
      }
    } else if (
      statement.type === 'ExpressionStatement' &&
      statement.expression.type === 'AssignmentExpression' &&
      isModuleExports(statement.expression.left)
    ) {
      defaultExport = statement.expression.right;
    }
  }

  const [first, ...rest] = path;
  if (typeof first !== 'string') {
    return undefined;
  }
  const root = resolveConfigObject(defaultExport);
  let value: Node | null | undefined = root && shapeOf(root).members.get(first)?.value;
  if (!resolveObject(value)) {
    // Prefer the named export here because getFieldNode also includes fields from the default
    // export.
    value = namedExports.get(first) ?? config.getFieldNode([first]);
  }
  for (const segment of rest) {
    const object = resolveObject(value);
    const member =
      object && typeof segment === 'string' ? shapeOf(object).members.get(segment) : undefined;
    if (!member) {
      return undefined;
    }
    value = member.value;
  }
  const object = resolveObject(value);
  return object && keysOf(object);
};
