import {
  type CsfObject,
  type ESTree as E,
  type ESTreeNode,
  staticKey,
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

// `argTypes: {...}` or `Story.argTypes = {...}`.
const isArgTypes = (node: ESTreeNode | null | undefined) =>
  !!node &&
  (staticKey(node) === 'argTypes' ||
    (node.type === 'AssignmentExpression' &&
      node.left.type === 'MemberExpression' &&
      node.left.property.type === 'Identifier' &&
      node.left.property.name === 'argTypes'));

/** Whether the file has a `defaultValue` key outside the docs `table` of an arg. */
const showsDefaultValue = (program: ESTreeNode) => {
  const parents = new Map<ESTreeNode, ESTreeNode | null>();
  let found = false;
  walk(program, (node, parent) => {
    parents.set(node, parent);
    const key = staticKey(node);
    found ||= key === 'defaultValue';
    return !found && !(key === 'table' && !isArgTypes(parent && parents.get(parent)));
  });
  return found;
};

const strip = (object: CsfObject) => {
  const argTypes = readForEdit(object, ['argTypes']);
  if (argTypes?.type !== 'ObjectExpression') {
    return;
  }
  for (const property of argTypes.properties) {
    const name = property.type === 'Property' ? argName(property) : undefined;
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
      editConfig: strip,
      editCsf: (csf) => {
        // `filter.code` also matches a read such as `args: { dir: dir.defaultValue }`.
        if (showsDefaultValue(csf.editor.program)) {
          csf.objects().forEach(strip);
        }
      },
    },
  ],
};
