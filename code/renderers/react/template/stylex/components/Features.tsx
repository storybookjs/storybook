import React from 'react';

import * as stylex from '@stylexjs/stylex';

import { breakpoints, spacing } from '../consts.stylex';

const highlight = stylex.keyframes({
  from: { backgroundColor: '#fde68a' },
  to: { backgroundColor: '#eff6ff' },
});

const styles = stylex.create({
  // Paused on its first frame, so the keyframe colour is stable for tests and snapshots
  animated: {
    animationDuration: '1s',
    animationName: highlight,
    animationPlayState: 'paused',
    backgroundColor: '#eff6ff',
  },
  spaced: {
    padding: spacing.gap,
  },
  button: {
    backgroundColor: {
      default: '#1d4ed8',
      ':disabled': '#9ca3af',
    },
    borderRadius: {
      default: 0,
      '@supports (display: grid)': 8,
    },
    color: {
      default: '#111827',
      [breakpoints.wide]: '#ffffff',
    },
  },
  label: {
    color: {
      default: '#111827',
      [stylex.when.siblingBefore(':checked')]: '#15803d',
    },
  },
});

export const Features = () => (
  <div>
    <p data-testid="keyframes" {...stylex.props(styles.animated)}>
      keyframes
    </p>
    <p data-testid="consts" {...stylex.props(styles.spaced)}>
      defineConsts
    </p>
    <button data-testid="enabled" {...stylex.props(styles.button)}>
      Enabled
    </button>
    <button data-testid="disabled" disabled {...stylex.props(styles.button)}>
      Disabled
    </button>
    <div>
      <input id="stylex-marker" type="checkbox" {...stylex.props(stylex.defaultMarker())} />
      <label htmlFor="stylex-marker" data-testid="marked" {...stylex.props(styles.label)}>
        Green when the checkbox before it is checked
      </label>
    </div>
  </div>
);
