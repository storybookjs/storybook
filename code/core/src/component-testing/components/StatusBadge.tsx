import React from 'react';

import { styled, typography } from 'storybook/theming';

import { type Call, CallStates } from '../../instrumenter/types';

export interface StatusBadgeProps {
  status: Call['status'];
}

const StatusColorMapping = {
  [CallStates.DONE]: 'positive',
  [CallStates.ERROR]: 'negative',
  [CallStates.ACTIVE]: 'warning',
  [CallStates.WAITING]: 'warning',
} as const;

const StyledBadge = styled.div<StatusBadgeProps>(({ theme, status }) => {
  const backgroundColor = theme.color[StatusColorMapping[status!]];
  return {
    padding: '4px 6px 4px 8px',
    borderRadius: '4px',
    backgroundColor,
    color: 'white',
    fontFamily: typography.fonts.base,
    textTransform: 'uppercase',
    fontSize: typography.size.s1,
    letterSpacing: 3,
    fontWeight: typography.weight.bold,
    width: 65,
    textAlign: 'center',
  };
});

const StatusTextMapping = {
  [CallStates.DONE]: 'Pass',
  [CallStates.ERROR]: 'Fail',
  [CallStates.ACTIVE]: 'Runs',
  [CallStates.WAITING]: 'Runs',
} as const;

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const badgeText = StatusTextMapping[status!];
  return (
    <StyledBadge aria-label="Status of the test run" status={status}>
      {badgeText}
    </StyledBadge>
  );
};
