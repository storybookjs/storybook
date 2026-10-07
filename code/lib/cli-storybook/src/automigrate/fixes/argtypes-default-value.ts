import type { CsfObject, ESTree as E } from 'storybook/internal/csf-tools';

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

const strip = (object: CsfObject) => {
  const argTypes = object.get(['argTypes']);
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
      editConfig: strip,
      editCsf: (csf) => {
        csf.objects().forEach(strip);
      },
    },
  ],
};
