import React from 'react';

import * as stylex from '@stylexjs/stylex';

const styles = stylex.create({
  box: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    color: '#1d4ed8',
    padding: 16,
  },
  width: (width: number) => ({ width }),
});

export interface BoxProps {
  /** Fixed width in pixels */
  width?: number;
  children?: React.ReactNode;
}

export const Box = ({ width, children }: BoxProps) => (
  <div data-testid="box" {...stylex.props(styles.box, width !== undefined && styles.width(width))}>
    {children}
  </div>
);
