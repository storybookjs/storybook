import type { ChangeEvent, FC } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Button, Form } from 'storybook/internal/components';

import { styled } from 'storybook/theming';

import { getControlId, getControlSetterButtonId } from './helpers';
import type { ControlProps, NumberConfig, NumberValue } from './types';

const Wrapper = styled.label({
  display: 'flex',
});

type NumberProps = ControlProps<NumberValue | null> & NumberConfig;

export const parse = (value: string) => {
  const result = parseFloat(value);
  return Number.isNaN(result) ? undefined : result;
};

export const format = (value: NumberValue) => (value != null ? String(value) : '');

const FormInput = styled(Form.Input)(({ theme }) => ({
  background: theme.base === 'light' ? theme.color.lighter : 'transparent',
}));

export const NumberControl: FC<NumberProps> = ({
  name,
  value,
  onChange,
  min,
  max,
  step,
  onBlur,
  onFocus,
  argType,
}) => {
  const [inputValue, setInputValue] = useState(typeof value === 'number' ? value : '');
  const [forceVisible, setForceVisible] = useState(false);
  const [parseError, setParseError] = useState<Error | null>(null);
  const readonly = !!argType?.table?.readonly;

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setInputValue(event.target.value);

      const result = parseFloat(event.target.value);
      if (Number.isNaN(result)) {
        setParseError(new Error(`'${event.target.value}' is not a number`));
      } else {
        // Initialize the final value as the user's input
        let finalValue = result;

        // Clamp to minimum: if finalValue is less than min, use min
        if (typeof min === 'number' && finalValue < min) {
          finalValue = min;
        }

        // Clamp to maximum: if finalValue is greater than max, use max
        if (typeof max === 'number' && finalValue > max) {
          finalValue = max;
        }

        // Pass the clamped final value to the onChange callback
        onChange(finalValue);
        // Clear any previous parse errors
        setParseError(null);

        // If the value was clamped, update the input display to the final value
        if (finalValue !== result) {
          setInputValue(String(finalValue));
        }
      }
    },
    [onChange, setParseError, min, max]
  );

  const onForceVisible = useCallback(() => {
    setInputValue('0');
    onChange(0);
    setForceVisible(true);
  }, [setForceVisible]);

  const htmlElRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (forceVisible && htmlElRef.current) {
      htmlElRef.current.select();
    }
  }, [forceVisible]);

  useEffect(() => {
    const newInputValue = typeof value === 'number' ? value : '';
    if (inputValue !== newInputValue) {
      setInputValue(newInputValue);
    }
  }, [value]);

  if (value === undefined) {
    return (
      <Button
        ariaLabel={false}
        variant="outline"
        size="medium"
        id={getControlSetterButtonId(name)}
        onClick={onForceVisible}
        disabled={readonly}
      >
        Set number
      </Button>
    );
  }

  return (
    <Wrapper>
      <FormInput
        ref={htmlElRef}
        id={getControlId(name)}
        type="number"
        onChange={handleChange}
        size="flex"
        placeholder="Edit number..."
        value={inputValue}
        valid={parseError ? 'error' : undefined}
        autoFocus={forceVisible}
        readOnly={readonly}
        {...{ name, min, max, step, onFocus, onBlur }}
      />
    </Wrapper>
  );
};
