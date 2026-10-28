import type { ArgsEnhancer } from '@storybook/core/internal/types';

import { addActionsFromArgTypes, inferActionsFromArgTypesRegex } from './addArgsHelpers.ts';

export const argsEnhancers: ArgsEnhancer[] = [
  addActionsFromArgTypes,
  inferActionsFromArgTypesRegex,
];
