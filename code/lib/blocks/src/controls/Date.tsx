import type { FC, ChangeEvent, RefObject } from 'react';
import React, { useState, useRef, useEffect } from 'react';
import { styled } from 'storybook/internal/theming';
import { Form } from 'storybook/internal/components';

import type { ControlProps, DateValue, DateConfig } from './types';
import { getControlId } from './helpers';

export const parseDate = (value: string) => {
  const [year, month, day] = value.split('-');
  const result = new Date();
  result.setFullYear(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  return result;
};

export const parseTime = (value: string) => {
  const [hours, minutes] = value.split(':');
  const result = new Date();
  result.setHours(parseInt(hours, 10));
  result.setMinutes(parseInt(minutes, 10));
  return result;
};

export const formatDate = (value: Date | number) => {
  const date = new Date(value);
  const year = `000${date.getFullYear()}`.slice(-4);
  const month = `0${date.getMonth() + 1}`.slice(-2);
  const day = `0${date.getDate()}`.slice(-2);
  return `${year}-${month}-${day}`;
};

export const formatTime = (value: Date | number) => {
  const date = new Date(value);
  const hours = `0${date.getHours()}`.slice(-2);
  const minutes = `0${date.getMinutes()}`.slice(-2);
  return `${hours}:${minutes}`;
};

const FormInput = styled(Form.Input)(({ readOnly }) => ({
  opacity: readOnly ? 0.5 : 1,
}));

const FlexSpaced = styled.div(({ theme }) => ({
  flex: 1,
  display: 'flex',

  input: {
    marginLeft: 10,
    flex: 1,
    height: 32, // hardcode height bc Chromium bug https://bugs.chromium.org/p/chromium/issues/detail?id=417606

    '&::-webkit-calendar-picker-indicator': {
      opacity: 0.5,
      height: 12,
      filter: theme.base === 'light' ? undefined : 'invert(1)',
    },
  },
  'input:first-of-type': {
    marginLeft: 0,
    flexGrow: 4,
  },
  'input:last-of-type': {
    flexGrow: 3,
  },
}));

export type DateProps = ControlProps<DateValue> & DateConfig;
export const DateControl: FC<DateProps> = ({ name, value, onChange, onFocus, onBlur, argType }) => {
  const [valid, setValid] = useState(true);
  const dateRef = useRef<HTMLInputElement>();
  const timeRef = useRef<HTMLInputElement>();
  const readonly = !!argType?.table?.readonly;

  useEffect(() => {
    if (valid !== false) {
      if (dateRef && dateRef.current) {
        dateRef.current.value = value ? formatDate(value) : '';
      }
      if (timeRef && timeRef.current) {
        timeRef.current.value = value ? formatTime(value) : '';
      }
    }
  }, [value]);

  const onDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return onChange();
    const parsed = parseDate(e.target.value);
    const result = new Date(value);
    result.setFullYear(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    const time = result.getTime();
    if (time) onChange(time);
    setValid(!!time);
  };

  const onTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return onChange();
    const parsed = parseTime(e.target.value);
    const result = new Date(value);
    result.setHours(parsed.getHours());
    result.setMinutes(parsed.getMinutes());
    const time = result.getTime();
    if (time) onChange(time);
    setValid(!!time);
  };

  const controlId = getControlId(name);

  return (
    <FlexSpaced>
      <FormInput
        type="date"
        max="9999-12-31" // I do this because of a rendering bug in chrome
        ref={dateRef as RefObject<HTMLInputElement>}
        id={`${controlId}-date`}
        name={`${controlId}-date`}
        readOnly={readonly}
        onChange={onDateChange}
        {...{ onFocus, onBlur }}
      />
      <FormInput
        type="time"
        id={`${controlId}-time`}
        name={`${controlId}-time`}
        ref={timeRef as RefObject<HTMLInputElement>}
        onChange={onTimeChange}
        readOnly={readonly}
        {...{ onFocus, onBlur }}
      />
      {!valid ? <div>invalid</div> : null}
    </FlexSpaced>
  );
};
