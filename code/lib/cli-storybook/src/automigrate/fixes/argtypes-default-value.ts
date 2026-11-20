import { type CsfObject, type ESTreeNode, staticKey, walk } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import { readForEdit } from '../helpers/edit-parsed-file.ts';
import type { Fix } from '../types.ts';

// The key of `key: value` or `Story.key = value`.
const keyOf = (node: ESTreeNode) =>
  staticKey(node) ??
  (node.type === 'AssignmentExpression' &&
  node.left.type === 'MemberExpression' &&
  !node.left.computed &&
  node.left.property.type === 'Identifier'
    ? node.left.property.name
    : undefined);

/**
 * Whether the file has a `defaultValue` key outside `args`, where it is a component prop, and the
 * docs `table` of an arg.
 */
const showsDefaultValue = (program: ESTreeNode) => {
  const parents = new Map<ESTreeNode, ESTreeNode | null>();
  let found = false;
  walk(program, (node, parent) => {
    parents.set(node, parent);
    const key = keyOf(node);
    found ||= key === 'defaultValue';
    // An arg can be named `args` or `table`, as in `argTypes: { table: {...} }`.
    const owner = parent && parents.get(parent);
    const skipped = (key === 'args' || key === 'table') && !(owner && keyOf(owner) === 'argTypes');
    return !found && !skipped;
  });
  return found;
};

const strip = (object: CsfObject) => {
  const argTypes = readForEdit(object, ['argTypes']);
  if (argTypes?.type !== 'ObjectExpression') {
    return;
  }
  for (const property of argTypes.properties) {
    const name = staticKey(property);
    if (name !== undefined) {
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
        // `filter.code` also matches a read such as `dir.defaultValue`, and a prop in `args`.
        if (showsDefaultValue(csf.editor.program)) {
          csf.objects().forEach(strip);
        }
      },
    },
  ],
};
