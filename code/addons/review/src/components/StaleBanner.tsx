import React, { type FC } from 'react';

import { styled } from 'storybook/theming';

import { CheckIcon, WandIcon } from '@storybook/icons';
import { CopyButton } from './CopyButton.tsx';

const Bar = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  flexShrink: 0,
  padding: '4px 16px',
  background: theme.background.hoverable,
  color: theme.color.defaultText,
  borderBottom: `1px solid ${theme.appBorderColor}`,
  fontSize: theme.typography.size.s2,
  minHeight: 32,
}));

// Prompt copied to the clipboard so a reviewer can paste it to their coding
// agent to regenerate the review against the current working tree.

/**
 * Attention bar shown at the top of the review screens when the cached review
 * has been marked stale (a source file changed after it was created).
 */
export const StaleBanner: FC = () => (
  <Bar role="status" aria-live="polite">
    <span>This review may be stale. Ask your agent to refresh it.</span>
    <CopyButton
      variant="ghost"
      padding="small"
      ariaLabel="Copy prompt to refresh this review"
      tooltip="Copy prompt"
      content="The Storybook review is stale. Generate a fresh review including my latest changes using the display-review tool."
      childrenOnCopy={<CheckIcon />}
    >
      <WandIcon />
    </CopyButton>
  </Bar>
);
