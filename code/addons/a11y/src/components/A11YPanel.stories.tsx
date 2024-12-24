import React from 'react';

import { ManagerContext } from 'storybook/internal/manager-api';
import { ThemeProvider, convert, themes } from 'storybook/internal/theming';

import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import type axe from 'axe-core';

import { A11YPanel } from './A11YPanel';
import { A11yContext } from './A11yContext';
import type { A11yContextStore } from './A11yContext';

const managerContext: any = {
  state: {},
  api: {
    getDocsUrl: fn().mockName('api::getDocsUrl'),
  },
};

const meta: Meta = {
  title: 'A11YPanel',
  component: A11YPanel,
  decorators: [
    (Story) => (
      <ManagerContext.Provider value={managerContext}>
        <ThemeProvider theme={convert(themes.light)}>
          <Story />
        </ThemeProvider>
      </ManagerContext.Provider>
    ),
  ],
} satisfies Meta<typeof A11YPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

const violations: axe.Result[] = [
  {
    id: 'aria-command-name',
    impact: 'serious',
    tags: ['cat.aria', 'wcag2a', 'wcag412', 'TTv5', 'TT6.a', 'EN-301-549', 'EN-9.4.1.2', 'ACT'],
    description: 'Ensures every ARIA button, link and menuitem has an accessible name',
    help: 'ARIA commands must have an accessible name',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/aria-command-name?application=axeAPI',
    nodes: [
      {
        any: [
          {
            id: 'has-visible-text',
            data: null,
            relatedNodes: [],
            impact: 'serious',
            message: 'Element does not have text that is visible to screen readers',
          },
          {
            id: 'aria-label',
            data: null,
            relatedNodes: [],
            impact: 'serious',
            message: 'aria-label attribute does not exist or is empty',
          },
          {
            id: 'aria-labelledby',
            data: null,
            relatedNodes: [],
            impact: 'serious',
            message:
              'aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty',
          },
          {
            id: 'non-empty-title',
            data: {
              messageKey: 'noAttr',
            },
            relatedNodes: [],
            impact: 'serious',
            message: 'Element has no title attribute',
          },
        ],
        all: [],
        none: [],
        impact: 'serious',
        html: '<div role="button" class="css-12jpz5t">',
        target: ['.css-12jpz5t'],
        failureSummary:
          'Fix any of the following:\n  Element does not have text that is visible to screen readers\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute',
      },
    ],
  },
];

const Template = (args: Pick<A11yContextStore, 'results' | 'error' | 'status' | 'discrepancy'>) => (
  <A11yContext.Provider
    value={{
      handleManual: fn(),
      highlighted: [],
      toggleHighlight: fn(),
      clearHighlights: fn(),
      tab: 0,
      setTab: fn(),
      setStatus: fn(),
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
    return (
      <Template
        results={{
          passes: [],
          incomplete: [],
          violations,
        }}
        status="ready"
        error={null}
        discrepancy={null}
      />
    );
  },
};

export const ReadyWithResultsDiscrepancyCLIPassedBrowserFailed: Story = {
  render: () => {
    return (
      <Template
        results={{
          passes: [],
          incomplete: [],
          violations,
        }}
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
