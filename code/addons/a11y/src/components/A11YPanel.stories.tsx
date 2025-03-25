import React from 'react';

import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';
import { styled } from 'storybook/theming';

import preview from '../../../../.storybook/preview';
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
    getCurrentParameter: fn().mockName('api::getCurrentParameter'),
  },
};

const meta = preview.meta({
  title: 'Panel',
  component: A11YPanel,
  parameters: {
    layout: 'fullscreen',
  },
});

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
    <ManagerContext.Provider value={managerContext}>
      <StyledWrapper id="panel-tab-content">
        <A11YPanel />
      </StyledWrapper>
    </ManagerContext.Provider>
  </A11yContext.Provider>
);

export const Initializing = meta.story({
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
});

export const Manual = meta.story({
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
});

export const ManualWithDiscrepancy = meta.story({
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
});

export const Running = meta.story({
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
});

export const ReadyWithResults = meta.story({
  render: () => {
    return <Template results={results} status="ready" error={null} discrepancy={null} />;
  },
});

export const ReadyWithResultsDiscrepancyCLIPassedBrowserFailed = meta.story({
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
});

export const Error = meta.story({
  render: () => {
    return (
      <Template
        results={{ passes: [], incomplete: [], violations: [] }}
        status="error"
        error={`TypeError: Configured rule { impact: "moderate", disable: true } is invalid. Rules must be an object with at least an id property.`}
        discrepancy={null}
      />
    );
  },
});

export const ErrorStateWithObject = meta.story({
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
});

export const Broken = meta.story({
  render: () => {
    return (
      <Template
        results={{ passes: [], incomplete: [], violations: [] }}
        status="component-test-error"
        error={null}
        discrepancy={null}
      />
    );
  },
});
