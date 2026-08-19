import type { FC } from 'react';
import React from 'react';

import { Button, PopoverProvider } from 'storybook/internal/components';

import { AlertIcon } from '@storybook/icons';
import { styled } from 'storybook/theming';

export const SNIPPET_WARNING_LABEL = 'Incomplete code snippet';

const Message = styled.div(({ theme }) => ({
  maxWidth: 280,
  padding: 8,
  color: theme.color.defaultText,
  fontSize: theme.typography.size.s1,
  lineHeight: '18px',
  // Providers join several caveats with newlines, and each one is its own sentence.
  whiteSpace: 'pre-line',
}));

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
    <PopoverProvider
      ariaLabel={SNIPPET_WARNING_LABEL}
      placement="bottom-end"
      padding={0}
      popover={<Message>{warning}</Message>}
    >
      <WarningButton
        className={className}
        ariaLabel={SNIPPET_WARNING_LABEL}
        variant="ghost"
        size="small"
        padding="small"
        // The popover carries the message; a hover tooltip on the same trigger would stack a second
        // overlay on top of it.
        disableAllTooltips
      >
        <AlertIcon />
      </WarningButton>
    </PopoverProvider>
  );
};
