import React from 'react';

import * as stylex from '@stylexjs/stylex';
import { brand } from 'stylex-tokens-fixture/tokens.stylex.js';

import { tokens } from '../tokens.stylex';

const styles = stylex.create({
  swatch: {
    fontWeight: 'bold',
    padding: 8,
  },
  local: {
    color: tokens.accent,
  },
  package: {
    color: brand.accent,
  },
});

export interface SwatchProps {
  /** Where the colour token comes from */
  source: 'local' | 'package';
}

export const Swatch = ({ source }: SwatchProps) => (
  <p data-testid="swatch" {...stylex.props(styles.swatch, styles[source])}>
    {source === 'local' ? 'Local token' : 'Package token'}
  </p>
);
