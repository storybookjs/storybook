import type { FC } from 'react';
import React from 'react';

import { Button } from 'storybook/internal/components';

import { AlertIcon } from '@storybook/icons';
import { styled } from 'storybook/theming';

export const SNIPPET_WARNING_LABEL = 'Incomplete code snippet';

const WarningButton = styled(Button)(({ theme }) => ({
  color: theme.fgColor.warning,

  '&:hover, &:focus-visible': {
    color: theme.fgColor.warning,
    background: theme.bgColor.warning,
  },
}));

export interface SnippetWarningProps {
  /** Why the snippet is an incomplete example; see `StoryDoc.warning`. */
  warning?: string;
  className?: string;
}

/**
 * Flags a snippet that is a deliberately incomplete example, and carries the reason.
 *
 * The snippet is still worth showing — it is the only place a reader sees which bindings a story
 * sets — so the caveat travels next to it rather than suppressing it. Renders nothing without a
 * warning, which keeps every snippet that has none looking exactly as it did.
 */
export const SnippetWarning: FC<SnippetWarningProps> = ({ warning, className }) => {
  if (!warning?.trim()) {
    return null;
  }

  return (
    <WarningButton
      className={className}
      // The label names the condition for screen readers; the tooltip carries the whole reason.
      ariaLabel={SNIPPET_WARNING_LABEL}
      tooltip={warning}
      variant="ghost"
      size="small"
      padding="small"
    >
      <AlertIcon />
    </WarningButton>
  );
};
