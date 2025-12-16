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
    '&:has(input:focus-visible)': {
      outline: `2px solid ${theme.color.secondary}`,
      outlineOffset: -2,
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
  unit?: string;
  baseUnit?: string;
}

export const NumericInput = forwardRef<{ select: () => void }, NumericInputProps>(
  function NumericInput(
    { label, before, after, value, setValue, unit, baseUnit, className, style, ...props },
    forwardedRef
  ) {
    const baseUnitRegex = useMemo(() => baseUnit && new RegExp(`${baseUnit}$`), [baseUnit]);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState(
      baseUnitRegex ? value.replace(baseUnitRegex, '') : value
    );

    useImperativeHandle(forwardedRef, () => inputRef.current!);

    const onChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        setValue(
          !baseUnit || Number.isNaN(Number(e.target.value))
            ? e.target.value
            : `${e.target.value}${baseUnit}`
        );
      },
      [setValue, baseUnit]
    );

    const setInputSelection = useCallback(() => {
      requestAnimationFrame(() => {
        const input = inputRef.current;
        const index = input?.value.search(/[^\d.]/) ?? -1;
        if (input && index > 0) {
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
        const num = parseInt(inputValue, 10);
        const update = e.key === 'ArrowUp' ? num + 1 : num - 1;
        if (!Number.isNaN(num) && update >= 0) {
          const inputUnit =
            inputValue.match(/(\d+(?:\.\d+)?)(\%|[a-z]{0,4})?$/)?.[2] || unit || baseUnit || '';
          setInputValue(`${update}${inputUnit === baseUnit ? '' : inputUnit}`);
          setValue(`${update}${inputUnit}`);
          setInputSelection();
        }
      };

      const input = inputRef.current;
      if (input) {
        input.addEventListener('keydown', handleKeyDown);
        return () => input.removeEventListener('keydown', handleKeyDown);
      }
    }, [inputValue, setValue, unit, baseUnit, inputRef, setInputSelection]);

    return (
      <Wrapper after={after} before={before} className={className} style={style}>
        {before && <div>{before}</div>}
        {label && <span className="sb-sr-only">{label}</span>}
        <Form.Input
          {...props}
          ref={inputRef}
          value={inputValue}
          onChange={onChange}
          onFocus={setInputSelection}
          onBlur={updateInputValue}
        />
        {after && <div>{after}</div>}
      </Wrapper>
    );
  }
);
