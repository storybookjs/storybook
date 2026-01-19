import React, { type HTMLProps } from 'react';
import { forwardRef } from 'react';

import { styled } from 'storybook/theming';

import {
  type Alignments,
  type Sizes,
  type ValidationStates,
  alignment,
  sizes,
  styles,
  validation,
} from './styles';

const Wrapper = styled.div({
  position: 'relative',
  width: '100%',
});

const Mask = styled.div(
  ({ theme }) => ({
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
    overflow: 'hidden',
    color: theme.textMutedColor,
    'span:first-of-type': {
      opacity: 0,
    },
  }),
  (props) => {
    const { fontSize, lineHeight, padding } = styles(props);
    return { fontSize, lineHeight, padding };
  }
);

type InputProps = Omit<
  HTMLProps<HTMLInputElement>,
  keyof {
    size?: Sizes;
    align?: Alignments;
    valid?: ValidationStates;
    height?: number;
  }
> & {
  size?: Sizes;
  align?: Alignments;
  valid?: ValidationStates;
  height?: number;
  suffix?: string;
};

export const Input = Object.assign(
  styled(
    forwardRef<any, InputProps>(function Input(
      { size, valid, align, value, suffix, ...props },
      ref
    ) {
      return (
        <Wrapper>
          <input {...props} value={value} ref={ref} />
          {suffix && (
            <Mask aria-hidden>
              <span>{value}</span>
              <span>{suffix}</span>
            </Mask>
          )}
        </Wrapper>
      );
    })
  )<InputProps>(styles, sizes, alignment, validation, {
    minHeight: 32,
  }),
  {
    displayName: 'Input',
  }
);
