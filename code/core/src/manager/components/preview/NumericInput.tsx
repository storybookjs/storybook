import type { ChangeEvent, ComponentProps, ReactNode } from 'react';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Form } from 'storybook/internal/components';

import { useId } from '@react-aria/utils';
import { styled } from 'storybook/theming';

const Wrapper = styled.div<{ after?: ReactNode; before?: ReactNode }>(
  ({ after, before, theme }) => ({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: 32,
    paddingInline: 9,
    fontSize: theme.typography.size.s1,
    color: theme.textMutedColor,
    background: theme.input.background,
    boxShadow: `${theme.input.border} 0 0 0 1px inset`,
    borderRadius: theme.input.borderRadius,
    svg: {
      display: 'block',
    },
    input: {
      width: '100%',
      height: '100%',
      minHeight: '100%',
      flex: '1 1 auto',
      paddingInline: 0,
      fontSize: 'inherit',
      background: 'transparent',
      border: 'none',
      boxShadow: 'none',
      color: theme.input.color,
      '&:focus, &:focus-visible': {
        boxShadow: 'none',
        outline: 'none',
      },
    },
    'input:disabled': {
      background: 'transparent',
    },
    'input + div': {
      paddingInline: 0,
      fontSize: 'inherit',
    },
    '&:has(input:focus-visible)': {
      outline: `2px solid ${theme.color.secondary}`,
      outlineOffset: -2,
    },
    '&:has(input:disabled)': {
      background: theme.base === 'light' ? theme.color.lighter : theme.input.background,
      cursor: 'not-allowed',
    },
    ...(after && { paddingRight: 2 }),
    ...(before && { paddingLeft: 2 }),
  })
);

interface NumericInputProps extends Omit<ComponentProps<typeof Form.Input>, 'value'> {
  label?: string;
  before?: ReactNode;
  after?: ReactNode;
  value: string;
  setValue: (value: string) => void;
  minValue?: number;
  maxValue?: number;
  unit?: string;
  baseUnit?: string;
}

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(function NumericInput(
  {
    label,
    before,
    after,
    value,
    setValue,
    minValue = -Infinity,
    maxValue = Infinity,
    unit: fixedUnit,
    baseUnit = fixedUnit,
    className,
    style,
    ...props
  },
  forwardedRef
) {
  const baseUnitRegex = useMemo(() => baseUnit && new RegExp(`${baseUnit}$`), [baseUnit]);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(
    baseUnitRegex ? value.replace(baseUnitRegex, '') : value
  );
  const id = props.id || inputId;

  useImperativeHandle(forwardedRef, () => inputRef.current!);

  const parseValue = useCallback(
    (value: string) => {
      const [, inputValue, unit = fixedUnit || baseUnit || ''] =
        value.match(/(-?\d+(?:\.\d+)?)(\%|[a-z]{1,4})?$/) || [];
      const number = Math.max(minValue, Math.min(parseFloat(inputValue), maxValue));
      return { number, unit };
    },
    [minValue, maxValue, fixedUnit, baseUnit]
  );

  const updateValue = useCallback(
    (value: string) => {
      const { number, unit } = parseValue(value);
      if (Number.isNaN(number)) {
        setInputValue(value);
      } else {
        setInputValue(`${number}${unit === baseUnit ? '' : unit}`);
        setValue(`${number}${unit}`);
      }
    },
    [parseValue, setValue, baseUnit]
  );

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => updateValue(e.target.value),
    [updateValue]
  );

  const setInputSelection = useCallback(() => {
    requestAnimationFrame(() => {
      const input = inputRef.current;
      const index = input?.value.search(/[^-\d.]/) ?? -1;
      if (input && index >= 0) {
        input.setSelectionRange(index, index);
      }
    });
  }, []);

  const updateInputValue = useCallback(
    () => setInputValue(baseUnitRegex ? value.replace(baseUnitRegex, '') : value),
    [value, baseUnitRegex]
  );

  useEffect(() => {
    if (inputRef.current !== document.activeElement) {
      updateInputValue();
    }
  }, [updateInputValue]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
        return;
      }
      e.preventDefault();

      const { number, unit } = parseValue(inputValue);
      if (!Number.isNaN(number)) {
        updateValue(`${e.key === 'ArrowUp' ? number + 1 : number - 1}${unit}`);
        setInputSelection();
      }
    };

    const input = inputRef.current;
    if (input) {
      input.addEventListener('keydown', handleKeyDown);
      return () => input.removeEventListener('keydown', handleKeyDown);
    }
  }, [inputValue, parseValue, updateValue, setInputSelection]);

  return (
    <Wrapper after={after} before={before} className={className} style={style}>
      {before && <div>{before}</div>}
      {label && (
        <label htmlFor={id} className="sb-sr-only">
          {label}
        </label>
      )}
      <Form.Input
        {...props}
        id={id}
        ref={inputRef}
        value={inputValue}
        suffix={fixedUnit ? fixedUnit : inputValue && baseUnit}
        onChange={onChange}
        onFocus={setInputSelection}
        onBlur={updateInputValue}
      />
      {after && <div>{after}</div>}
    </Wrapper>
  );
});
