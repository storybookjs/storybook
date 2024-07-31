import React from 'react';
import { type Call, CallStates } from '@storybook/instrumenter';
import { styled, typography } from 'storybook/internal/theming';

export interface StatusBadgeProps {
  status: Call['status'];
}

const StyledBadge = styled.div<StatusBadgeProps>(({ theme, status }) => {
  const backgroundColor = {
    [CallStates.DONE]: theme.color.positive,
    [CallStates.ERROR]: theme.color.negative,
    [CallStates.ACTIVE]: theme.color.warning,
    [CallStates.WAITING]: theme.color.warning,
  }[status];
  return {
    padding: '4px 6px 4px 8px;',
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

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const badgeText = {
    [CallStates.DONE]: 'Pass',
    [CallStates.ERROR]: 'Fail',
    [CallStates.ACTIVE]: 'Runs',
    [CallStates.WAITING]: 'Runs',
  }[status];
  return (
    <StyledBadge aria-label="Status of the test run" status={status}>
      {badgeText}
    </StyledBadge>
  );
};
