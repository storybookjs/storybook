import type { FC } from 'react';
import React from 'react';

import { styled } from 'storybook/theming';

import { CopyIcon, StatusPassIcon } from '@storybook/icons';

import { CopyButton } from './CopyButton.tsx';

export const STALE_REFRESH_PROMPT =
  'Generate a fresh review including my latest changes using the display-review tool.';

const Content = styled.div({
  padding: 15,
  width: 280,
  boxSizing: 'border-box',
});

const Message = styled.div(({ theme }) => ({
  color: theme.color.defaultText,
  lineHeight: '18px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 8,
}));

const Title = styled.div(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
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

export const StaleNoticePopoverContent: FC = () => (
  <Content>
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
  </Content>
);
