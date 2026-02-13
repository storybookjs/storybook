/**
 * MetricCard - displays a single performance metric with status
 */

import React from 'react';
import { styled } from 'storybook/internal/theming';
import type { BudgetStatus } from '../types';
import { getStatusColor, getStatusEmoji } from '../utils/budget';

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  status: BudgetStatus;
  description?: string;
}

const Card = styled.div<{ status: BudgetStatus }>`
  background: ${(props) => props.theme.background.content};
  border: 1px solid ${(props) => props.theme.appBorderColor};
  border-left: 4px solid ${(props) => getStatusColor(props.status)};
  border-radius: 4px;
  padding: 12px 16px;
  min-width: 140px;
  flex: 1;
`;

const Label = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${(props) => props.theme.color.mediumdark};
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Value = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: ${(props) => props.theme.color.defaultText};
  line-height: 1.2;
`;

const Unit = styled.span`
  font-size: 14px;
  font-weight: 400;
  color: ${(props) => props.theme.color.mediumdark};
  margin-left: 2px;
`;

const Description = styled.div`
  font-size: 11px;
  color: ${(props) => props.theme.color.medium};
  margin-top: 4px;
`;

const StatusIndicator = styled.span<{ status: BudgetStatus }>`
  color: ${(props) => getStatusColor(props.status)};
  font-size: 12px;
`;

export function MetricCard({ label, value, unit, status, description }: MetricCardProps) {
  return (
    <Card status={status}>
      <Label>
        <StatusIndicator status={status}>{getStatusEmoji(status)}</StatusIndicator>
        {label}
      </Label>
      <Value>
        {typeof value === 'number' ? value.toFixed(2) : value}
        {unit && <Unit>{unit}</Unit>}
      </Value>
      {description && <Description>{description}</Description>}
    </Card>
  );
}
