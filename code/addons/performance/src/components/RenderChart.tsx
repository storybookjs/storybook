/**
 * RenderChart - visualizes render history as a simple bar chart
 */

import React from 'react';
import { styled } from 'storybook/internal/theming';
import type { ProfilerData } from '../types';
import { DEFAULT_BUDGET } from '../constants';
import { formatMs, getStatusColor } from '../utils/budget';

export interface RenderChartProps {
  renders: ProfilerData[];
  budget?: { renderTime?: number; renderTimeWarn?: number };
  maxBars?: number;
}

const Container = styled.div`
  background: ${(props) => props.theme.background.content};
  border: 1px solid ${(props) => props.theme.appBorderColor};
  border-radius: 4px;
  padding: 16px;
  margin-top: 16px;
`;

const Title = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${(props) => props.theme.color.defaultText};
  margin-bottom: 12px;
`;

const ChartContainer = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 100px;
  padding-bottom: 20px;
  position: relative;
`;

const Bar = styled.div<{ height: number; status: 'good' | 'warning' | 'bad' }>`
  flex: 1;
  max-width: 40px;
  min-width: 8px;
  height: ${(props) => Math.max(props.height, 2)}%;
  background: ${(props) => getStatusColor(props.status)};
  border-radius: 2px 2px 0 0;
  position: relative;
  transition: height 0.2s ease;

  &:hover {
    opacity: 0.8;
  }
`;

const BarLabel = styled.div`
  position: absolute;
  bottom: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: ${(props) => props.theme.color.medium};
  white-space: nowrap;
`;

const Tooltip = styled.div`
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: ${(props) => props.theme.background.app};
  border: 1px solid ${(props) => props.theme.appBorderColor};
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 10px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 10;

  ${Bar}:hover & {
    opacity: 1;
  }
`;

const BudgetLine = styled.div<{ position: number; color: string }>`
  position: absolute;
  left: 0;
  right: 0;
  bottom: ${(props) => props.position}%;
  border-bottom: 2px dashed ${(props) => props.color};
  opacity: 0.5;

  &::after {
    content: attr(data-label);
    position: absolute;
    right: 0;
    top: -14px;
    font-size: 9px;
    color: ${(props) => props.color};
  }
`;

const EmptyState = styled.div`
  text-align: center;
  color: ${(props) => props.theme.color.medium};
  font-size: 12px;
  padding: 20px;
`;

export function RenderChart({ renders, budget = DEFAULT_BUDGET, maxBars = 20 }: RenderChartProps) {
  if (renders.length === 0) {
    return (
      <Container>
        <Title>Render Timeline</Title>
        <EmptyState>No renders recorded yet</EmptyState>
      </Container>
    );
  }

  // Take the last N renders
  const displayRenders = renders.slice(-maxBars);

  // Calculate max for scaling
  const maxDuration = Math.max(
    ...displayRenders.map((r) => r.actualDuration),
    budget.renderTime || DEFAULT_BUDGET.renderTime,
    budget.renderTimeWarn || DEFAULT_BUDGET.renderTimeWarn
  );

  const getStatus = (duration: number): 'good' | 'warning' | 'bad' => {
    const good = budget.renderTime || DEFAULT_BUDGET.renderTime;
    const warn = budget.renderTimeWarn || DEFAULT_BUDGET.renderTimeWarn;
    if (duration <= good) return 'good';
    if (duration <= warn) return 'warning';
    return 'bad';
  };

  const goodLine = ((budget.renderTime || DEFAULT_BUDGET.renderTime) / maxDuration) * 100;
  const warnLine = ((budget.renderTimeWarn || DEFAULT_BUDGET.renderTimeWarn) / maxDuration) * 100;

  return (
    <Container>
      <Title>Render Timeline ({renders.length} total renders)</Title>
      <ChartContainer>
        <BudgetLine
          position={Math.min(goodLine, 98)}
          color={getStatusColor('good')}
          data-label={`${budget.renderTime || DEFAULT_BUDGET.renderTime}ms`}
        />
        <BudgetLine
          position={Math.min(warnLine, 98)}
          color={getStatusColor('warning')}
          data-label={`${budget.renderTimeWarn || DEFAULT_BUDGET.renderTimeWarn}ms`}
        />
        {displayRenders.map((render, index) => {
          const height = (render.actualDuration / maxDuration) * 100;
          const status = getStatus(render.actualDuration);
          return (
            <Bar key={`${render.timestamp}-${index}`} height={height} status={status}>
              <Tooltip>
                {formatMs(render.actualDuration)} ({render.phase})
              </Tooltip>
              <BarLabel>{render.phase[0].toUpperCase()}</BarLabel>
            </Bar>
          );
        })}
      </ChartContainer>
    </Container>
  );
}
