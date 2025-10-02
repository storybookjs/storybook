import React from 'react';

import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { styled } from 'storybook/theming';

import preview from '../../../../.storybook/preview';
import { results } from '../results.mock';
import { type EnhancedResults, RuleType } from '../types';
import { A11YPanel } from './A11YPanel';
import { A11yContext } from './A11yContext';
import type { A11yContextStore } from './A11yContext';

const emptyResults: EnhancedResults = {
  passes: [],
  incomplete: [],
  violations: [],
  toolOptions: {},
  inapplicable: [],
  testEngine: { name: '', version: '' },
  testRunner: { name: '' },
  testEnvironment: { userAgent: '', windowWidth: 0, windowHeight: 0 },
  url: '',
  timestamp: '',
};

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

const context = {
  parameters: {},
  handleManual: fn(),
  highlighted: false,
  toggleHighlight: fn(),
  tab: RuleType.VIOLATION,
  setTab: fn(),
  setStatus: fn(),
  handleCopyLink: fn(),
  toggleOpen: fn(),
  allExpanded: false,
  handleCollapseAll: fn(),
  handleExpandAll: fn(),
  handleSelectionChange: fn(),
  handleJumpToElement: fn(),
};

const Template = (
  args: Pick<A11yContextStore, 'results' | 'error' | 'status' | 'discrepancy' | 'selectedItems'> &
    Pick<Partial<A11yContextStore>, 'parameters'>
) => (
  <A11yContext.Provider value={{ ...context, ...args }}>
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
        results={emptyResults}
        status="initial"
        error={null}
        discrepancy={null}
        selectedItems={new Map()}
      />
    );
  },
});

export const Disabled = meta.story({
  render: () => {
    return (
      <Template
        results={emptyResults}
        status="initial"
        error={null}
        discrepancy={null}
        selectedItems={new Map()}
        parameters={{ disable: true }}
      />
    );
  },
});

export const Manual = meta.story({
  render: () => {
    return (
      <Template
        results={emptyResults}
        status="manual"
        error={null}
        discrepancy={null}
        selectedItems={new Map()}
      />
    );
  },
});

export const ManualWithDiscrepancy = meta.story({
  render: () => {
    return (
      <Template
        results={emptyResults}
        status="manual"
        error={null}
        discrepancy={'cliFailedButModeManual'}
        selectedItems={new Map()}
      />
    );
  },
});

export const Running = meta.story({
  render: () => {
    return (
      <Template
        results={emptyResults}
        status="running"
        error={null}
        discrepancy={null}
        selectedItems={new Map()}
      />
    );
  },
});

export const ReadyWithResults = meta.story({
  render: () => {
    return (
      <Template
        results={results}
        status="ready"
        error={null}
        discrepancy={null}
        selectedItems={
          new Map([
            [
              `${RuleType.VIOLATION}.${results.violations[0].id}`,
              `${RuleType.VIOLATION}.${results.violations[0].id}.1`,
            ],
          ])
        }
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const btn = await waitFor(
      () => canvas.findByRole('button', { name: /Rerun accessibility scan/ }),
      { timeout: 3000 }
    );
    await userEvent.click(btn);
    expect(context.handleManual).toHaveBeenCalled();
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
        selectedItems={
          new Map([
            [
              `${RuleType.VIOLATION}.${results.violations[0].id}`,
              `${RuleType.VIOLATION}.${results.violations[0].id}.1`,
            ],
          ])
        }
      />
    );
  },
});

export const Error = meta.story({
  render: () => {
    return (
      <Template
        results={emptyResults}
        status="error"
        error={`TypeError: Configured rule { impact: "moderate", disable: true } is invalid. Rules must be an object with at least an id property.`}
        discrepancy={null}
        selectedItems={new Map()}
      />
    );
  },
});

export const ErrorStateWithObject = meta.story({
  render: () => {
    return (
      <Template
        results={emptyResults}
        status="error"
        error={{ message: 'Test error object message' }}
        discrepancy={null}
        selectedItems={new Map()}
      />
    );
  },
});

export const Broken = meta.story({
  render: () => {
    return (
      <Template
        results={emptyResults}
        status="component-test-error"
        error={null}
        discrepancy={null}
        selectedItems={new Map()}
      />
    );
  },
});
