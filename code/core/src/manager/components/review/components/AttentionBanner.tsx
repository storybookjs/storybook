import React, { type FC } from 'react';

import { Button, Link, PopoverProvider } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import { CopyIcon, StatusPassIcon, TransferIcon } from '@storybook/icons';
import { CopyButton } from './CopyButton.tsx';

export const STALE_REFRESH_PROMPT =
  'Generate a fresh review including my latest changes using the display-review tool.';

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
  minHeight: 40,
}));

const PopoverContent = styled.div({
  padding: 15,
  width: 280,
  boxSizing: 'border-box',
});

const Title = styled.div(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
}));

const Message = styled.div(({ theme }) => ({
  color: theme.color.defaultText,
  lineHeight: '18px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 8,
}));

const Prompt = styled.p(({ theme }) => ({
  margin: 0,
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1 - 1,
  padding: '6px 10px',
  background: theme.background.app,
  boxShadow: `inset 0 0 0 1px ${theme.appBorderColor}`,
  borderRadius: theme.appBorderRadius,
}));

export type AttentionBannerKind = 'stale' | 'pending-update';

export type AttentionBannerProps =
  | { kind: 'stale' }
  | { kind: 'pending-update'; onAccept: () => void };

/**
 * Attention bar at the top of review screens. Stale warns that source files
 * changed after the review was created; pending-update offers a newer push.
 */
export const AttentionBanner: FC<AttentionBannerProps> = (props) => {
  const { kind } = props;

  if (kind === 'pending-update') {
    const { onAccept } = props;
    return (
      <Bar role="status" aria-live="polite">
        <span>An updated review is available.</span>
        <Button variant="solid" padding="small" onClick={onAccept}>
          Update
        </Button>
      </Bar>
    );
  }

  return (
    <Bar role="status" aria-live="polite">
      <span>
        Code changes detected. This review may be stale.{' '}
        <PopoverProvider
          ariaLabel="Prompt to refresh stale review"
          placement="bottom"
          padding={0}
          popover={
            <PopoverContent>
              <Message>
                <Title>Prompt for your agent to refresh this review:</Title>
                <Prompt>{STALE_REFRESH_PROMPT}</Prompt>
                <CopyButton
                  appearance="agentic"
                  padding="small"
                  ariaLabel="Copy prompt to refresh this review"
                  ariaLabelOnCopy="Prompt copied to clipboard"
                  content={STALE_REFRESH_PROMPT}
                  childrenOnCopy={
                    <>
                      <StatusPassIcon /> Copy prompt
                    </>
                  }
                >
                  <CopyIcon />
                  Copy prompt
                </CopyButton>
              </Message>
            </PopoverContent>
          }
        >
          <Link>
            <strong>Ask your agent to refresh it.</strong>
          </Link>
        </PopoverProvider>
      </span>
    </Bar>
  );
};
