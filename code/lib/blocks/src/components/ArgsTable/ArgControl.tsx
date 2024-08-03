import type { FC } from 'react';
import React, { useCallback, useState, useEffect } from 'react';

import { Link } from 'storybook/internal/components';
import {
  BooleanControl,
  ColorControl,
  DateControl,
  FilesControl,
  NumberControl,
  ObjectControl,
  OptionsControl,
  RangeControl,
  TextControl,
} from '../../controls';
import type { Args, ArgType } from './types';

export interface ArgControlProps {
  row: ArgType;
  arg: any;
  updateArgs: (args: Args) => void;
  isHovered: boolean;
}

const Controls: Record<string, FC> = {
  array: ObjectControl,
  object: ObjectControl,
  boolean: BooleanControl,
  color: ColorControl,
  date: DateControl,
  number: NumberControl,
  check: OptionsControl,
  'inline-check': OptionsControl,
  radio: OptionsControl,
  'inline-radio': OptionsControl,
  select: OptionsControl,
  'multi-select': OptionsControl,
  range: RangeControl,
  text: TextControl,
  file: FilesControl,
};

const NoControl = () => <>-</>;

export const ArgControl: FC<ArgControlProps> = ({ row, arg, updateArgs, isHovered }) => {
  const { key, control } = row;

  const [isFocused, setFocused] = useState(false);
  // box because arg can be a fn (e.g. actions) and useState calls fn's
  const [boxedValue, setBoxedValue] = useState({ value: arg });

  useEffect(() => {
    if (!isFocused) setBoxedValue({ value: arg });
  }, [isFocused, arg]);

  const onChange = useCallback(
    (argVal: any) => {
      setBoxedValue({ value: argVal });
      updateArgs({ [key]: argVal });
      return argVal;
    },
    [updateArgs, key]
  );

  const onBlur = useCallback(() => setFocused(false), []);
  const onFocus = useCallback(() => setFocused(true), []);

  if (!control || control.disable) {
    const canBeSetup = control?.disable !== true && row?.type?.name !== 'function';
    return isHovered && canBeSetup ? (
      <Link
        href="https://storybook.js.org/docs/react/essentials/controls"
        target="_blank"
        withArrow
      >
        Setup controls
      </Link>
    ) : (
      <NoControl />
    );
  }
  // row.name is a display name and not a suitable DOM input id or name - i might contain whitespace etc.
  // row.key is a hash key and therefore a much safer choice
  const props = { name: key, argType: row, value: boxedValue.value, onChange, onBlur, onFocus };
  const Control = Controls[control.type] || NoControl;
  return <Control {...props} {...control} controlType={control.type} />;
};
