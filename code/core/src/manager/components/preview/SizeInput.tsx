import type { ComponentProps } from 'react';
import React, { useEffect, useRef } from 'react';

import { Form } from 'storybook/internal/components';

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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
        return;
      }
      e.preventDefault();
      const num = parseInt(value, 10);
      const unit = value.match(/[0-9. ]+(.*)$/)?.[1] || 'px';
      const update = e.key === 'ArrowUp' ? num + 1 : num - 1;
      if (!Number.isNaN(num) && update >= 0) {
        setValue(`${update}${unit}`);
      }
    };
    const input = inputRef.current;
    if (input) {
      input.addEventListener('keydown', handleKeyDown);
      return () => input.removeEventListener('keydown', handleKeyDown);
    }
  }, [value, setValue]);

  return (
    <Wrapper prefix={prefix}>
      {label && <span className="sb-sr-only">{label}</span>}
      <Form.Input
        {...props}
        ref={inputRef}
        value={value.replace(/px$/, '')}
        onChange={(e) => setValue((e.target as HTMLInputElement).value)}
      />
    </Wrapper>
  );
};
