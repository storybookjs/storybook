import React from 'react';

import { type Color, styled, typography } from 'storybook/theming';

export type PlayStatus = 'rendering' | 'playing' | 'completed' | 'errored' | 'aborted';

export interface StatusBadgeProps {
  status: PlayStatus;
}

const StatusColorMapping: Record<PlayStatus, keyof Color> = {
  rendering: 'mediumdark',
  playing: 'warning',
  completed: 'positive',
  errored: 'negative',
  aborted: 'purple',
} as const;

const StatusTextMapping: Record<PlayStatus, string> = {
  rendering: 'Wait',
  playing: 'Runs',
  completed: 'Pass',
  errored: 'Fail',
  aborted: 'Bail',
} as const;

const StyledBadge = styled.div<StatusBadgeProps>(({ theme, status }) => {
  const backgroundColor = theme.color[StatusColorMapping[status]];
  return {
    display: 'inline-block',
    padding: '4px 6px 4px 8px',
    borderRadius: '4px',
    backgroundColor,
    color: 'white',
    fontFamily: typography.fonts.base,
    textTransform: 'uppercase',
    fontSize: typography.size.s1,
    letterSpacing: 3,
    fontWeight: typography.weight.bold,
    minWidth: 65,
    textAlign: 'center',
  };
});

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const badgeText = StatusTextMapping[status];
  return (
    <StyledBadge aria-label="Status of the test run" status={status}>
      {badgeText}
    </StyledBadge>
  );
};
