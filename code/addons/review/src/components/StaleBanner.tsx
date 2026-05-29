import React, { type FC } from 'react';

import { styled } from 'storybook/theming';

import { AlertIcon } from '@storybook/icons';

const Bar = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  flexShrink: 0,
  padding: '8px 16px',
  background: theme.background.warning,
  color: theme.color.warningText,
  borderBottom: `1px solid ${theme.appBorderColor}`,
  fontSize: theme.typography.size.s2,
  fontWeight: theme.typography.weight.bold,
  lineHeight: '20px',
}));

const IconWrap = styled.span({
  display: 'inline-flex',
  flexShrink: 0,
});

/**
 * Attention bar shown at the top of the review screens when the cached review
 * has been marked stale (a source file changed after it was created).
 */
export const StaleBanner: FC = () => (
  <Bar role="status" aria-live="polite">
    <IconWrap>
      <AlertIcon />
    </IconWrap>
    <span>New changes were made. This review may be stale.</span>
  </Bar>
);
