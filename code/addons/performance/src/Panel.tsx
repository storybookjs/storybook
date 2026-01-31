/**
 * Performance Panel - main UI component for the addon
 */

import React from 'react';
import { useParameter } from 'storybook/manager-api';
import { styled } from 'storybook/internal/theming';
import { IconButton, Placeholder } from 'storybook/internal/components';
import { DownloadIcon, TrashIcon } from '@storybook/icons';
import { DEFAULT_BUDGET, PARAM_KEY } from './constants';
import type { PerformanceParameters, ProfilerData } from './types';
import { usePerformanceData } from './hooks/usePerformanceData';
import { evaluateBudget, formatMs } from './utils/budget';
import { MetricCard } from './components/MetricCard';
import { RenderChart } from './components/RenderChart';
import { BudgetIndicator } from './components/BudgetIndicator';

interface PanelProps {
  active: boolean;
  storyId?: string;
}

const PanelContainer = styled.div`
  padding: 16px;
  height: 100%;
  overflow: auto;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const Title = styled.h2`
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: ${(props) => props.theme.color.defaultText};
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
`;

const Section = styled.div`
  margin-top: 24px;
`;

const SectionTitle = styled.h3`
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${(props) => props.theme.color.mediumdark};
  margin: 0 0 12px 0;
`;

const StatsRow = styled.div`
  display: flex;
  gap: 24px;
  font-size: 12px;
  color: ${(props) => props.theme.color.medium};
`;

const Stat = styled.span`
  display: flex;
  gap: 4px;

  strong {
    color: ${(props) => props.theme.color.defaultText};
  }
`;

const DisabledMessage = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: ${(props) => props.theme.color.medium};
`;

// Sub-component for recent renders list
const RenderList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const RenderItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: ${(props) => props.theme.background.app};
  border-radius: 4px;
  font-size: 12px;
`;

const RenderPhase = styled.span<{ phase: string }>`
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  background: ${(props) =>
    props.phase === 'mount'
      ? '#66bf3c30'
      : props.phase === 'update'
        ? '#e69d0030'
        : '#ff440030'};
  color: ${(props) =>
    props.phase === 'mount' ? '#66bf3c' : props.phase === 'update' ? '#e69d00' : '#ff4400'};
`;

const RenderDuration = styled.span`
  font-weight: 600;
  color: ${(props) => props.theme.color.defaultText};
`;

const RenderTime = styled.span`
  color: ${(props) => props.theme.color.medium};
  margin-left: auto;
`;

interface RecentRendersListProps {
  renders: ProfilerData[];
}

function RecentRendersList({ renders }: RecentRendersListProps) {
  return (
    <RenderList>
      {renders.map((render, index) => (
        <RenderItem key={`${render.timestamp}-${index}`}>
          <RenderPhase phase={render.phase}>{render.phase}</RenderPhase>
          <RenderDuration>{formatMs(render.actualDuration)}</RenderDuration>
          <span>actual</span>
          <span>|</span>
          <span>{formatMs(render.baseDuration)} base</span>
          <RenderTime>{new Date(render.timestamp).toLocaleTimeString()}</RenderTime>
        </RenderItem>
      ))}
    </RenderList>
  );
}

export function Panel({ active, storyId }: PanelProps) {
  const parameters = useParameter<PerformanceParameters>(PARAM_KEY, {});
  const { data, clearData, isLoading } = usePerformanceData(storyId);

  if (!active) {
    return null;
  }

  if (parameters?.disable) {
    return (
      <PanelContainer>
        <DisabledMessage>
          Performance tracking is disabled for this story.
          <br />
          <small>
            Remove <code>parameters.performance.disable</code> to enable.
          </small>
        </DisabledMessage>
      </PanelContainer>
    );
  }

  if (!storyId) {
    return (
      <PanelContainer>
        <Placeholder>Select a story to view performance metrics</Placeholder>
      </PanelContainer>
    );
  }

  if (isLoading || !data) {
    return (
      <PanelContainer>
        <Placeholder>Loading performance data...</Placeholder>
      </PanelContainer>
    );
  }

  const budget = { ...DEFAULT_BUDGET, ...parameters?.budget };
  const budgetResult = evaluateBudget(data, parameters?.budget);

  return (
    <PanelContainer>
      <Header>
        <Title>⚡ Performance Profiler</Title>
        <Actions>
          <IconButton title="Clear metrics" onClick={clearData}>
            <TrashIcon />
          </IconButton>
          <IconButton
            title="Export JSON"
            onClick={() => {
              const json = JSON.stringify(data, null, 2);
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `perf-${storyId}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <DownloadIcon />
          </IconButton>
        </Actions>
      </Header>

      <BudgetIndicator budget={budgetResult} />

      <MetricsGrid>
        <MetricCard
          label="Avg Render Time"
          value={data.avgRenderTime}
          unit="ms"
          status={budgetResult.renderTime}
          description={`Budget: ${budget.renderTime}ms`}
        />
        <MetricCard
          label="Re-renders"
          value={data.rerenderCount}
          status={budgetResult.rerenderCount}
          description={`Budget: ≤${budget.rerenderLimit}`}
        />
        <MetricCard
          label="Total Renders"
          value={data.renderCount}
          status="good"
          description="Mount + updates"
        />
        <MetricCard
          label="CLS"
          value={data.metrics.cls}
          status={budgetResult.cls}
          description={`Budget: <${budget.cls}`}
        />
        <MetricCard
          label="Long Tasks"
          value={data.metrics.longTaskCount}
          status={budgetResult.longTasks}
          description=">50ms tasks"
        />
        <MetricCard
          label="Base Duration"
          value={data.renders.length > 0 ? data.renders[data.renders.length - 1].baseDuration : 0}
          unit="ms"
          status="good"
          description="Without memo"
        />
      </MetricsGrid>

      <Section>
        <SectionTitle>Render Statistics</SectionTitle>
        <StatsRow>
          <Stat>
            Min: <strong>{formatMs(data.minRenderTime)}</strong>
          </Stat>
          <Stat>
            Max: <strong>{formatMs(data.maxRenderTime)}</strong>
          </Stat>
          <Stat>
            Avg: <strong>{formatMs(data.avgRenderTime)}</strong>
          </Stat>
          {data.firstRender && data.lastRender && (
            <Stat>
              Duration: <strong>{formatMs(data.lastRender - data.firstRender)}</strong>
            </Stat>
          )}
        </StatsRow>
      </Section>

      <RenderChart renders={data.renders} budget={budget} />

      {data.renders.length > 0 && (
        <Section>
          <SectionTitle>Recent Renders</SectionTitle>
          <RecentRendersList renders={data.renders.slice(-10).reverse()} />
        </Section>
      )}
    </PanelContainer>
  );
}
