import React from 'react';

import * as stylex from '@stylexjs/stylex';

import { tokens } from '../tokens.stylex';

const styles = stylex.create({
  surface: {
    backgroundColor: tokens.surface,
    color: tokens.text,
    padding: 24,
  },
  accent: {
    color: tokens.accent,
  },
});

export const ThemeSurface = () => (
  <div data-testid="surface" {...stylex.props(styles.surface)}>
    Themed surface <span {...stylex.props(styles.accent)}>with an accent</span>
  </div>
);
