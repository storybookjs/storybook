import type { ChangeEvent, ComponentProps } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Form } from 'storybook/internal/components';

import { useId } from '@react-aria/utils';
import { styled } from 'storybook/theming';

const Wrapper = styled.span<{ prefix?: string }>(({ theme, prefix }) => ({
  position: 'relative',
  fontSize: theme.typography.size.s1,
  input: {
    width: 70,
    height: 28,
    minHeight: 28,
    paddingLeft: 25,
    paddingRight: 0,
    fontSize: 'inherit',
    '&:focus': {
      boxShadow: 'none',
      outline: `2px solid ${theme.color.secondary}`,
      outlineOffset: -2,
    },
  },
  ...(prefix && {
    '&::before': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      content: `"${prefix}"`,
      position: 'absolute',
      left: 5,
      top: 0,
      bottom: 0,
      width: 20,
      zIndex: 1,
      color: theme.textMutedColor,
    },
  }),
}));

export const SizeInput = ({
  label,
  prefix,
  value,
  setValue,
  ...props
}: {
  label?: string;
  prefix?: string;
  value: string;
  setValue: (value: string) => void;
} & Omit<ComponentProps<typeof Form.Input>, 'value'>) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(value.replace(/px$/, ''));
  const id = props.id || inputId;

  useEffect(() => setInputValue(value.replace(/px$/, '')), [value]);

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
      setValue(Number.isNaN(Number(e.target.value)) ? e.target.value : `${e.target.value}px`);
    },
    [setValue]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
        return;
      }
      e.preventDefault();
      const num = parseInt(inputValue, 10);
      const update = e.key === 'ArrowUp' ? num + 1 : num - 1;
      if (!Number.isNaN(num) && update >= 0) {
        const unit = inputValue.match(/[0-9]{1,4}(%|[a-z]{0,4})?$/)?.[1] || 'px';
        setInputValue(`${update}${unit === 'px' ? '' : unit}`);
        setValue(`${update}${unit}`);
      }
    };

    const input = inputRef.current;
    if (input) {
      input.addEventListener('keydown', handleKeyDown);
      return () => input.removeEventListener('keydown', handleKeyDown);
    }
  }, [inputValue, setValue]);

  return (
    <Wrapper prefix={prefix}>
      {label && (
        <label htmlFor={id} className="sb-sr-only">
          {label}
        </label>
      )}
      <Form.Input {...props} id={id} ref={inputRef} value={inputValue} onChange={onChange} />
    </Wrapper>
  );
};
