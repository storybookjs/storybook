import React, { type ComponentProps } from 'react';

import { keyframes, styled } from '@storybook/core/theming';

const XMLNS = 'http://www.w3.org/2000/svg';

const rotate = keyframes({
  '0%': {
    transform: 'rotate(0deg)',
  },
  '100%': {
    transform: 'rotate(360deg)',
  },
});

const Wrapper = styled.div<{ size: number }>(({ size }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  minWidth: size,
  minHeight: size,
}));

const Circle = styled.svg<{ size: number; width: number; progress?: boolean; spinner?: boolean }>(
  ({ size, width }) => ({
    position: 'absolute',
    width: `${size}px!important`,
    height: `${size}px!important`,
    transform: 'rotate(-90deg)',
    circle: {
      r: (size - Math.ceil(width)) / 2,
      cx: size / 2,
      cy: size / 2,
      opacity: 0.15,
      fill: 'transparent',
      stroke: 'currentColor',
      strokeWidth: width,
      strokeLinecap: 'round',
      strokeDasharray: Math.PI * (size - Math.ceil(width)),
    },
  }),
  ({ progress }) =>
    progress && {
      circle: {
        opacity: 0.75,
      },
    },
  ({ spinner }) =>
    spinner && {
      animation: `${rotate} 1s linear infinite`,
      circle: {
        opacity: 0.25,
      },
    }
);

interface ProgressSpinnerProps extends Omit<ComponentProps<typeof Wrapper>, 'size'> {
  percentage?: number;
  running?: boolean;
  size?: number;
  width?: number;
  children?: React.ReactNode;
}

export const ProgressSpinner = ({
  percentage = undefined,
  running = true,
  size = 24,
  width = 1.5,
  children = null,
  ...props
}: ProgressSpinnerProps) =>
  typeof percentage === 'number' ? (
    <Wrapper size={size} {...props}>
      {children}
      <Circle size={size} width={width} xmlns={XMLNS}>
        <circle />
      </Circle>
      {running && (
        <Circle size={size} width={width} xmlns={XMLNS} spinner>
          <circle strokeDashoffset={Math.PI * (size - Math.ceil(width)) * (1 - percentage / 100)} />
        </Circle>
      )}
      <Circle size={size} width={width} xmlns={XMLNS} progress>
        <circle strokeDashoffset={Math.PI * (size - Math.ceil(width)) * (1 - percentage / 100)} />
      </Circle>
    </Wrapper>
  ) : (
    <Wrapper size={size} {...props}>
      {children}
    </Wrapper>
  );
