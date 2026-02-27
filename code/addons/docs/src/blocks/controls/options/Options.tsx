import type { FC } from 'react';
import React from 'react';

import type { ControlProps, Options, OptionsConfig, OptionsSelection } from '../types';
import { CheckboxControl } from './Checkbox';
import { RadioControl } from './Radio';
import { SelectControl } from './Select';

/**
 * Options can accept `options` in two formats:
 *
 * - Array: ['a', 'b', 'c'] OR
 * - Object: { a: 1, b: 2, c: 3 } (deprecated)
 *
 * We always normalize to the more generalized object format and ONLY handle the object format in
 * the underlying control implementations.
 *
 * While non-primitive values are deprecated, they might still not be valid object keys, so the
 * resulting object is a Label -> Value mapping.
 */
const normalizeOptions = (options: Options, labels?: Record<any, string>) => {
  if (Array.isArray(options)) {
    return options.reduce((acc, item) => {
      const label = labels?.[item];
      // Ensure the label is a string to avoid using non-string values (e.g., Array prototype
      // methods) as object keys. This can happen when an option's name matches a built-in array
      // method (e.g. 'reverse') and `labels` is inadvertently an array instead of a Record.
      // See: https://github.com/storybookjs/storybook/issues/30142
      acc[typeof label === 'string' && label !== '' ? label : String(item)] = item;
      return acc;
    }, {});
  }
  return options;
};

const Controls = {
  check: CheckboxControl,
  'inline-check': CheckboxControl,
  radio: RadioControl,
  'inline-radio': RadioControl,
  select: SelectControl,
  'multi-select': SelectControl,
} as const;

export type OptionsProps = ControlProps<OptionsSelection> & OptionsConfig;
export const OptionsControl: FC<OptionsProps> = (props) => {
  const { type = 'select', labels, argType } = props;
  const normalized = {
    ...props,
    argType,
    options: argType ? normalizeOptions(argType.options, labels) : {},
    isInline: type.includes('inline'),
    isMulti: type.includes('multi'),
  };

  const Control = Controls[type];

  if (Control) {
    return <Control {...normalized} />;
  }

  throw new Error(`Unknown options type: ${type}`);
};
