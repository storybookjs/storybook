import React, { type FC, type ReactNode } from 'react';

import { styled } from 'storybook/theming';

import { useViewport } from '../../../../core/src/viewport/useViewport.ts';

const ViewportFrame = styled.div<{ $isDefault: boolean }>(({ $isDefault }) => ({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
  ...($isDefault
    ? {
        flex: 1,
        width: '100%',
        height: '100%',
      }
    : {
        alignSelf: 'flex-start',
        justifySelf: 'flex-start',
      }),
}));

interface ReviewDetailViewportProps {
  scale: number;
  children: ReactNode;
}

/** Applies manager viewport dimensions to the review detail preview iframe. */
export const ReviewDetailViewport: FC<ReviewDetailViewportProps> = ({ scale, children }) => {
  const { width, height, isDefault } = useViewport();

  const frameStyle = isDefault
    ? undefined
    : {
        width: `calc(${width} * ${scale})`,
        height: `calc(${height} * ${scale})`,
      };

  return (
    <ViewportFrame $isDefault={isDefault} style={frameStyle}>
      {children}
    </ViewportFrame>
  );
};
