import {
  type CsfObject,
  type ESTree as E,
  type ESTreeNode,
  staticKey,
  unwrapExpression,
  walk,
} from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';

const argName = (property: E.ObjectProperty): string | undefined => {
  if (property.key.type === 'Identifier' && !property.computed) {
    return property.key.name;
  }
  if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
    return property.key.value;
  }
  return undefined;
};

/** The value written to `argTypes` by `argTypes: …` or `X.argTypes = …`. */
const argTypesValue = (node: ESTreeNode) => {
  if (node.type === 'Property' && staticKey(node) === 'argTypes') {
    return node.value;
  }
  if (
    node.type === 'AssignmentExpression' &&
    node.left.type === 'MemberExpression' &&
    !node.left.computed &&
    node.left.property.type === 'Identifier' &&
    node.left.property.name === 'argTypes'
  ) {
    return node.right;
  }
  return undefined;
};

const hasField = (node: ESTreeNode | null | undefined, key: string) => {
  const object = unwrapExpression(node);
  return (
    object?.type === 'ObjectExpression' &&
    object.properties.some((property) => staticKey(property as ESTreeNode) === key)
  );
};

/**
 * Whether the file writes a literal `argTypes: { <name>: { defaultValue } }`. Only such a field is
 * this migration's to remove: `defaultValue` has set no arg since 7.0, so one behind a helper or a
 * spread does nothing and is left alone, and a file without one is not edited at all.
 */
const writesArgTypeDefaultValue = (program: E.Program) => {
  let found = false;
  walk(program as ESTreeNode, (node) => {
    const argTypes = unwrapExpression(argTypesValue(node) as ESTreeNode | undefined);
    if (argTypes?.type === 'ObjectExpression') {
      found ||= argTypes.properties.some(
        (property) =>
          property.type === 'Property' && hasField(property.value as ESTreeNode, 'defaultValue')
      );
    }
    return !found;
  });
  return found;
};

/** Remove every `defaultValue` written in an argType of `object`; the editor reports one it cannot. */
const strip = (object: CsfObject) => {
  const argTypes = object.inspect(['argTypes']);
  if (argTypes.kind !== 'value' || argTypes.node.type !== 'ObjectExpression') {
    return;
  }
  for (const property of argTypes.node.properties) {
    if (property.type !== 'Property') {
      continue;
    }
    const name = argName(property);
    if (name && hasField(property.value as ESTreeNode, 'defaultValue')) {
      object.remove(['argTypes', name, 'defaultValue']);
    }
  }
};

export const argtypesDefaultValue: Fix = {
  id: 'argtypes-default-value',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#argtypes-defaultvalue-removed',

  prompt() {
    return `Remove deprecated ${picocolors.cyan('argTypes.<name>.defaultValue')}? It no longer sets an arg. Use ${picocolors.cyan('args')} or ${picocolors.cyan('table.defaultValue')}.`;
  },

  transform: () => [
    {
      filter: { kind: ['preview', 'story'], code: 'defaultValue' },
      editConfig: strip,
      // `objects()` reports the stories it cannot read, so it runs only when there is work.
      editCsf: (csf) => {
        if (writesArgTypeDefaultValue(csf.program)) {
          csf.objects().forEach(strip);
        }
      },
    },
  ],
};
