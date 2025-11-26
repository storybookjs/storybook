import type { FC } from 'react';
import React, { useRef } from 'react';

import { useToolbar } from '@react-aria/toolbar';

import { Bar, type BarProps } from '../Bar/Bar';

export interface AbstractToolbarProps {
  className?: string;
  children?: React.ReactNode;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export const AbstractToolbar: FC<AbstractToolbarProps> = ({
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

export interface ToolbarProps extends AbstractToolbarProps, BarProps {}

export const Toolbar: FC<ToolbarProps> = ({
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
