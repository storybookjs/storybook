/**
 * BudgetIndicator - shows overall budget status with breakdown
 */

import React from 'react';
import { styled } from 'storybook/internal/theming';
import type { BudgetResult } from '../utils/budget';
import { getStatusColor, getStatusEmoji } from '../utils/budget';

export interface BudgetIndicatorProps {
  budget: BudgetResult;
}

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: ${(props) => props.theme.background.app};
  border-radius: 4px;
  margin-bottom: 16px;
`;

const OverallStatus = styled.div<{ status: 'good' | 'warning' | 'bad' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: ${(props) => getStatusColor(props.status)}20;
  border: 1px solid ${(props) => getStatusColor(props.status)};
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
  color: ${(props) => getStatusColor(props.status)};
`;

const StatusDot = styled.span<{ status: 'good' | 'warning' | 'bad' }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(props) => getStatusColor(props.status)};
`;

const Breakdown = styled.div`
  display: flex;
  gap: 16px;
  flex: 1;
`;

const BreakdownItem = styled.div`
  font-size: 11px;
  color: ${(props) => props.theme.color.mediumdark};
  display: flex;
  align-items: center;
  gap: 4px;
`;

const StatusIcon = styled.span<{ status: 'good' | 'warning' | 'bad' }>`
  color: ${(props) => getStatusColor(props.status)};
`;

const statusLabels = {
  good: 'Passing',
  warning: 'Warning',
  bad: 'Failing',
} as const;

export function BudgetIndicator({ budget }: BudgetIndicatorProps) {
  return (
    <Container>
      <OverallStatus status={budget.overall}>
        <StatusDot status={budget.overall} />
        Budget: {statusLabels[budget.overall]}
      </OverallStatus>
      <Breakdown>
        <BreakdownItem>
          <StatusIcon status={budget.renderTime}>{getStatusEmoji(budget.renderTime)}</StatusIcon>
          Render Time
        </BreakdownItem>
        <BreakdownItem>
          <StatusIcon status={budget.rerenderCount}>
            {getStatusEmoji(budget.rerenderCount)}
          </StatusIcon>
          Re-renders
        </BreakdownItem>
        <BreakdownItem>
          <StatusIcon status={budget.cls}>{getStatusEmoji(budget.cls)}</StatusIcon>
          CLS
        </BreakdownItem>
        <BreakdownItem>
          <StatusIcon status={budget.longTasks}>{getStatusEmoji(budget.longTasks)}</StatusIcon>
          Long Tasks
        </BreakdownItem>
      </Breakdown>
    </Container>
  );
}
