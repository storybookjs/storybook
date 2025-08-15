import type { FC } from 'react';
import React, { useRef } from 'react';

import { Bar, type BarProps } from 'storybook/internal/components';

import { useToolbar } from '@react-aria/toolbar';

export interface AbstractAriaToolbarProps {
  className?: string;
  children?: React.ReactNode;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export const AbstractAriaToolbar: FC<AbstractAriaToolbarProps> = ({
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...rest
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const { toolbarProps } = useToolbar(
    {
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledby,
      orientation: 'horizontal',
    },
    ref
  );

  return <div ref={ref} {...toolbarProps} {...rest} />;
};

export interface AriaToolbarProps extends AbstractAriaToolbarProps, BarProps {}

export const AriaToolbar: FC<AriaToolbarProps> = ({
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...rest
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const { toolbarProps } = useToolbar(
    {
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledby,
      orientation: 'horizontal',
    },
    ref
  );

  return <Bar ref={ref} {...toolbarProps} {...rest} />;
};
