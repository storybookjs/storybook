import type React from 'react';

import { styled } from 'storybook/theming';

export interface Option {
  /** Optional rendering of the option. */
  children?: React.ReactNode;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  value: string | number | null | boolean | Symbol;
}

export interface ResetOption extends Omit<Option, 'value'> {
  value: undefined;
}

export const PAGE_STEP_SIZE = 5;

export const Listbox = styled('ul')({
  minWidth: 180,
  height: '100%',
  borderRadius: 6,
  overflow: 'hidden auto',
  listStyle: 'none',
  margin: 0,
  padding: 4,
});

export const UNDEFINED_VALUE = Symbol.for('undefined');