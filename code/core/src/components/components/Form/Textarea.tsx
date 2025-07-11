import React, { forwardRef } from 'react';

import TextareaAutoResize from 'react-textarea-autosize';
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

/**
 * These types are copied from `react-textarea-autosize`. I copied them because of
 * https://github.com/storybookjs/storybook/issues/18734 Maybe there's some bug in `tsup` or
 * `react-textarea-autosize`?
 */
type TextareaPropsRaw = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
type Style = Omit<NonNullable<TextareaPropsRaw['style']>, 'maxHeight' | 'minHeight'> & {
  height?: number;
};
type TextareaHeightChangeMeta = {
  rowHeight: number;
};
export interface TextareaAutosizeProps extends Omit<TextareaPropsRaw, 'style'> {
  maxRows?: number;
  minRows?: number;
  onHeightChange?: (height: number, meta: TextareaHeightChangeMeta) => void;
  cacheMeasurements?: boolean;
  style?: Style;
}

type TextareaProps = Omit<
  TextareaAutosizeProps,
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
} & React.RefAttributes<HTMLTextAreaElement>;

export const Textarea = Object.assign(
  styled(
    forwardRef<any, TextareaProps>(function Textarea({ size, valid, align, ...props }, ref) {
      return <TextareaAutoResize {...props} ref={ref} />;
    })
  )<TextareaProps>(styles, sizes, alignment, validation, ({ height = 400 }) => ({
    overflow: 'visible',
    maxHeight: height,
  })),
  {
    displayName: 'Textarea',
  }
);
