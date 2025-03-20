import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';
import { styled } from 'storybook/theming';

import { results } from '../results.mock';
import { RuleType } from '../types';
import { A11YPanel } from './A11YPanel';
import { A11yContext } from './A11yContext';
import type { A11yContextStore } from './A11yContext';

const StyledWrapper = styled.div(({ theme }) => ({
  backgroundColor: theme.background.content,
  fontSize: theme.typography.size.s2 - 1,
  color: theme.color.defaultText,
  display: 'block',
  height: '100%',
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  overflow: 'auto',
}));

const managerContext: any = {
  state: {},
  api: {
    getDocsUrl: fn().mockName('api::getDocsUrl'),
  },
};

const meta: Meta = {
  title: 'Panel',
  component: A11YPanel,
  decorators: [
    (Story) => (
      <ManagerContext.Provider value={managerContext}>
        <StyledWrapper id="panel-tab-content">
          <Story />
        </StyledWrapper>
      </ManagerContext.Provider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof A11YPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

const Template = (args: Pick<A11yContextStore, 'results' | 'error' | 'status' | 'discrepancy'>) => (
  <A11yContext.Provider
    value={{
      handleManual: fn(),
      highlighted: false,
      toggleHighlight: fn(),
      tab: RuleType.VIOLATION,
      setTab: fn(),
      setStatus: fn(),
      handleCopyLink: fn().mockName('handleCopyLink'),
      selectedItems: new Map(),
      toggleOpen: fn(),
      allExpanded: false,
      handleCollapseAll: fn(),
      handleExpandAll: fn(),
      handleSelectionChange: fn(),
      handleJumpToElement: fn(),
      ...args,
    }}
  >
    <A11YPanel />
  </A11yContext.Provider>
);

export const Initializing: Story = {
  render: () => {
    return (
      <Template
        results={{ passes: [], incomplete: [], violations: [] }}
        status="initial"
        error={null}
        discrepancy={null}
      />
    );
  },
};

export const Manual: Story = {
  render: () => {
    return (
      <Template
        results={{ passes: [], incomplete: [], violations: [] }}
        status="manual"
        error={null}
        discrepancy={null}
      />
    );
  },
};

export const ManualWithDiscrepancy: Story = {
  render: () => {
    return (
      <Template
        results={{ passes: [], incomplete: [], violations: [] }}
        status="manual"
        error={null}
        discrepancy={'cliFailedButModeManual'}
      />
    );
  },
};

export const Running: Story = {
  render: () => {
    return (
      <Template
        results={{ passes: [], incomplete: [], violations: [] }}
        status="running"
        error={null}
        discrepancy={null}
      />
    );
  },
};

export const ReadyWithResults: Story = {
  render: () => {
    return <Template results={results} status="ready" error={null} discrepancy={null} />;
  },
};

export const ReadyWithResultsDiscrepancyCLIPassedBrowserFailed: Story = {
  render: () => {
    return (
      <Template
        results={results}
        status="ready"
        error={null}
        discrepancy={'cliPassedBrowserFailed'}
      />
    );
  },
};

export const Error: Story = {
  render: () => {
    return (
      <Template
        results={{ passes: [], incomplete: [], violations: [] }}
        status="error"
        error="Test error message"
        discrepancy={null}
      />
    );
  },
};

export const ErrorStateWithObject: Story = {
  render: () => {
    return (
      <Template
        results={{ passes: [], incomplete: [], violations: [] }}
        status="error"
        error={{ message: 'Test error object message' }}
        discrepancy={null}
      />
    );
  },
};
