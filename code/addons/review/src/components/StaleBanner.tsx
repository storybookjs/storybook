import React, { type FC, useEffect, useRef, useState } from 'react';

import { Button } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import { CheckIcon, WandIcon } from '@storybook/icons';

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
const REFRESH_REVIEW_PROMPT =
  'The Storybook review is stale. Generate a fresh review including my latest changes using the display-review tool.';

const COPIED_RESET_MS = 2000;

/**
 * Attention bar shown at the top of the review screens when the cached review
 * has been marked stale (a source file changed after it was created).
 */
export const StaleBanner: FC = () => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    []
  );

  const handleCopy = () => {
    // eslint-disable-next-line compat/compat
    navigator.clipboard?.writeText(REFRESH_REVIEW_PROMPT).then(() => {
      setCopied(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    });
  };

  return (
    <Bar role="status" aria-live="polite">
      <span>This review may be stale. Ask your agent to refresh it.</span>
      <Button
        variant="ghost"
        padding="small"
        ariaLabel="Copy prompt to refresh this review"
        tooltip={copied ? 'Prompt copied' : 'Copy prompt'}
        onClick={handleCopy}
      >
        {copied ? <CheckIcon /> : <WandIcon />}
      </Button>
    </Bar>
  );
};
