import React, { type FC } from 'react';

import { styled } from 'storybook/theming';

import { CheckIcon, CopyIcon } from '@storybook/icons';
import { CopyButton } from './CopyButton.tsx';
import { Link, PopoverProvider } from 'storybook/internal/components';

const REFRESH_PROMPT =
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
  minHeight: 32,
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
  fontSize: theme.typography.size.s2 - 1,
  padding: '6px 10px',
  background: theme.background.app,
  boxShadow: `inset 0 0 0 1px ${theme.appBorderColor}`,
  borderRadius: theme.appBorderRadius,
}));

/**
 * Attention bar shown at the top of the review screens when the cached review
 * has been marked stale (a source file changed after it was created).
 */
export const StaleBanner: FC = () => (
  <Bar role="status" aria-live="polite">
    <span>
      This review may be stale.{' '}
      <PopoverProvider
        ariaLabel="Prompt to refresh stale review"
        placement="bottom"
        padding={0}
        popover={
          <PopoverContent>
            <Message>
              <Title>Prompt for your agent to refresh this review:</Title>
              <Prompt>{REFRESH_PROMPT}</Prompt>
              <CopyButton
                padding="small"
                ariaLabel="Copy prompt to refresh this review"
                content={REFRESH_PROMPT}
                childrenOnCopy={
                  <>
                    <CheckIcon /> Copied
                  </>
                }
              >
                <CopyIcon /> Copy prompt
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
