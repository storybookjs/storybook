import { type CsfObject, anyKey } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';

// An arg the source does not show a defaultValue for, such as `intl: intlArgType(...)`, is left.
// `remove` refuses a config with mixed default and named exports even when nothing matches.
const strip = (object: CsfObject) => {
  if (object.inspect(['argTypes']).kind !== 'missing') {
    object.remove(['argTypes', anyKey, 'defaultValue']);
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
      editCsf: (csf) => csf.objects().forEach(strip),
    },
  ],
};
