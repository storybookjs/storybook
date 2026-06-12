import React, { type FC } from 'react';

import { Button } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import { CheckIcon, TransferIcon, WandIcon } from '@storybook/icons';
import { CopyButton } from './CopyButton.tsx';

const STALE_REFRESH_PROMPT =
  'The Storybook review is stale. Generate a fresh review including my latest changes using the display-review tool.';

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

export type AttentionBannerKind = 'stale' | 'pending-update';

export type AttentionBannerProps =
  | { kind: 'stale' }
  | { kind: 'pending-update'; onAccept: () => void };

/**
 * Attention bar at the top of review screens. Stale warns that source files
 * changed after the review was created; pending-update offers a newer push.
 */
export const AttentionBanner: FC<AttentionBannerProps> = (props) => (
  <Bar role="status" aria-live="polite">
    {props.kind === 'pending-update' ? (
      <>
        <span>An updated review is available.</span>
        <Button variant="solid" padding="small" onClick={props.onAccept}>
          <TransferIcon />
          Switch
        </Button>
      </>
    ) : (
      <>
        <span>This review may be stale. Ask your agent to refresh it.</span>
        <CopyButton
          variant="ghost"
          padding="small"
          ariaLabel="Copy prompt to refresh this review"
          tooltip="Copy prompt"
          content={STALE_REFRESH_PROMPT}
          childrenOnCopy={<CheckIcon />}
        >
          <WandIcon />
        </CopyButton>
      </>
    )}
  </Bar>
);
