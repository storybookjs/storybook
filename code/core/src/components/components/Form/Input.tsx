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
};

export const Input = Object.assign(
  styled(
    forwardRef<any, InputProps>(function Input({ size, valid, align, ...props }, ref) {
      return <input {...props} ref={ref} />;
    })
  )<InputProps>(styles, sizes, alignment, validation, {
    minHeight: 32,
  }),
  {
    displayName: 'Input',
  }
);
