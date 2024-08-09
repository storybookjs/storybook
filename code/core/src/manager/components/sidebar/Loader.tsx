import type { FC } from 'react';
import React, { Fragment } from 'react';

import { styled } from '@storybook/core/theming';

const LOADER_SEQUENCE = [0, 0, 1, 1, 2, 3, 3, 3, 1, 1, 1, 2, 2, 2, 3];

const Loadingitem = styled.div<{
  depth?: number;
}>(
  {
    cursor: 'progress',
    fontSize: 13,
    height: '16px',
    marginTop: 4,
    marginBottom: 4,
    alignItems: 'center',
    overflow: 'hidden',
  },
  ({ depth = 0 }) => ({
    marginLeft: depth * 15,
    maxWidth: 85 - depth * 5,
  }),
  ({ theme }) => theme.animation.inlineGlow,
  ({ theme }) => ({
    background: theme.appBorderColor,
  })
);

export const Contained = styled.div({
  display: 'flex',
  flexDirection: 'column',
  paddingLeft: 20,
  paddingRight: 20,
});

interface LoaderProps {
  /**
   * The number of lines to display in the loader.
   * These are indented according to a pre-defined sequence of depths.
   */
  size: number;
}

export const Loader: FC<LoaderProps> = ({ size }) => {
  const repeats = Math.ceil(size / LOADER_SEQUENCE.length);
  // Creates an array that repeats LOADER_SEQUENCE depths in order, until the size is reached.
  const sequence = Array.from(Array(repeats)).fill(LOADER_SEQUENCE).flat().slice(0, size);
  return (
    <Fragment>
      {sequence.map((depth, index) => (
        <Loadingitem depth={depth} key={index} />
      ))}
    </Fragment>
  );
};
