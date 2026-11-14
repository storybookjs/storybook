import {
  type CsfObject,
  type ESTree as E,
  type ESTreeNode,
  staticKey,
  unwrapExpression,
  walk,
} from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import { readForEdit } from '../helpers/edit-parsed-file.ts';
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
 * this migration's to remove: `defaultValue` has set no arg since 7.0, so a file without one is not
 * edited at all, and its argTypes or stories the editor cannot read are not reported.
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

const strip = (object: CsfObject) => {
  const argTypes = readForEdit(object, ['argTypes']);
  if (argTypes?.type !== 'ObjectExpression') {
    return;
  }
  for (const property of argTypes.properties) {
    if (property.type !== 'Property') {
      continue;
    }
    const name = argName(property);
    if (name) {
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
      // An edit reports every argType and story it cannot read, so it runs only when there is work.
      editConfig: (config) => {
        if (writesArgTypeDefaultValue(config.program)) {
          strip(config);
        }
      },
      editCsf: (csf) => {
        if (writesArgTypeDefaultValue(csf.program)) {
          csf.objects().forEach(strip);
        }
      },
    },
  ],
};
