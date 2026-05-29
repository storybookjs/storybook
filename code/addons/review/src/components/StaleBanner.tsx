import React, { type FC } from 'react';

import { styled } from 'storybook/theming';

const Bar = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  flexShrink: 0,
  padding: '8px 16px',
  background: theme.background.hoverable,
  color: theme.color.defaultText,
  borderBottom: `1px solid ${theme.appBorderColor}`,
  fontSize: theme.typography.size.s2,
  fontWeight: theme.typography.weight.bold,
}));

/**
 * Attention bar shown at the top of the review screens when the cached review
 * has been marked stale (a source file changed after it was created).
 */
export const StaleBanner: FC = () => (
  <Bar role="status" aria-live="polite">
    <span>New changes were made. This review may be stale.</span>
  </Bar>
);
