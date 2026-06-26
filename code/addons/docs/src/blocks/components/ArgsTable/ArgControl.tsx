import type { FC } from 'react';
import React, { useCallback, useEffect, useState } from 'react';

import { Link } from 'storybook/internal/components';

import { styled } from 'storybook/theming';

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
import type { ArgType, Args } from './types';

export interface ArgControlProps {
  row: ArgType;
  arg: any;
  updateArgs: (args: Args) => void;
  isRequired: boolean;
  storyId?: string;
  controlsId?: string;
}

/** Parent row toggles visibility purely with CSS (see `StyledTr` in `ArgRow`).  */
const SetupControlsLink = styled.span({
  display: 'none',
});

const NoControlPlaceholder = styled.span({
  display: 'inline',
});

const Controls: Record<string, FC<any>> = {
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

export const ArgControl: FC<ArgControlProps> = ({
  row,
  arg,
  updateArgs,
  isRequired,
  storyId,
  controlsId,
}) => {
  const { key, control } = row;

  const [isFocused, setFocused] = useState(false);
  // box because arg can be a fn (e.g. actions) and useState calls fn's
  const [boxedValue, setBoxedValue] = useState({ value: arg });

  useEffect(() => {
    if (!isFocused) {
      setBoxedValue({ value: arg });
    }
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
    if (!canBeSetup) {
      return <NoControl />;
    }
    // Both nodes are always rendered; the parent row toggles their visibility with CSS on
    // :hover and :focus-within, so the link stays reachable for keyboard users.
    return (
      <>
        <span className="sbdocs sbdocs-argcontrol-placeholder">
          <Link
            href="https://storybook.js.org/docs/essentials/controls?ref=ui"
            target="_blank"
            withArrow
          >
            Setup controls
          </Link>
        </span>
        <span>
          <NoControl />
        </span>
      </>
    );
  }
  // row.name is a display name and not a suitable DOM input id or name - i might contain whitespace etc.
  // row.key is a hash key and therefore a much safer choice
  const props = {
    name: key,
    storyId,
    controlsId,
    argType: row,
    value: boxedValue.value,
    required: isRequired,
    onChange,
    onBlur,
    onFocus,
  };
  const Control = Controls[control.type] || NoControl;
  return <Control {...props} {...control} controlType={control.type} />;
};
