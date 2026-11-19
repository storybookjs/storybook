import {
  type CsfObject,
  type ESTree as E,
  type ESTreeNode,
  type ScopeInfo,
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

/**
 * Whether an expression has a `defaultValue` key outside `table`, following names to the
 * module-level constants of the file. One that another file declares is out of reach.
 */
const showsDefaultValue = (node: ESTreeNode, scopes: ScopeInfo, seen = new Set<string>()) => {
  let found = false;
  walk(node, (child) => {
    const key = staticKey(child);
    found ||= key === 'defaultValue';
    if (found || key === 'table') {
      return false;
    }
    const name = child.type === 'Identifier' ? child.name : undefined;
    const binding = name && !seen.has(name) ? scopes.program.lookup(name) : undefined;
    if (binding?.kind === 'const' && binding.node.type === 'VariableDeclarator') {
      seen.add(binding.name);
      found = !!binding.node.init && showsDefaultValue(binding.node.init, scopes, seen);
    }
  });
  return found;
};

const strip = (object: CsfObject, scopes: ScopeInfo) => {
  const argTypes = readForEdit(object, ['argTypes']);
  if (argTypes?.type !== 'ObjectExpression') {
    return;
  }
  for (const property of argTypes.properties) {
    if (property.type !== 'Property') {
      continue;
    }
    const name = argName(property);
    if (!name) {
      continue;
    }
    const path = ['argTypes', name, 'defaultValue'];
    const found = object.inspect(path);
    // An arg the editor cannot read, such as `intl: intlArgType(...)`, fails only for a
    // defaultValue it shows.
    if (
      found.kind === 'value' ||
      (found.kind === 'unreadable' && showsDefaultValue(property.value, scopes))
    ) {
      object.remove(path);
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
      editConfig: (config) => strip(config, config.editor.scopes),
      editCsf: (csf) => {
        // `filter.code` also matches a read such as `args: { dir: dir.defaultValue }`.
        if (showsDefaultValue(csf.editor.program, csf.editor.scopes)) {
          csf.objects().forEach((object) => strip(object, csf.editor.scopes));
        }
      },
    },
  ],
};
