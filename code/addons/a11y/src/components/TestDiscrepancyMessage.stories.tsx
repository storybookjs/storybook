import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';

import { TestDiscrepancyMessage } from './TestDiscrepancyMessage';

type Story = StoryObj<typeof TestDiscrepancyMessage>;

const managerContext: any = {
  state: {},
  api: {
    getDocsUrl: fn().mockName('api::getDocsUrl'),
  },
};

export default {
  title: 'TestDiscrepancyMessage',
  component: TestDiscrepancyMessage,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    storyId: 'story-id',
  },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={managerContext}>{storyFn()}</ManagerContext.Provider>
    ),
  ],
} as Meta<typeof TestDiscrepancyMessage>;

export const BrowserPassedCliFailed: Story = {
  args: {
    discrepancy: 'browserPassedCliFailed',
  },
};

export const CliPassedBrowserFailed: Story = {
  args: {
    discrepancy: 'cliPassedBrowserFailed',
  },
};

export const CliFailedButModeManual: Story = {
  args: {
    discrepancy: 'cliFailedButModeManual',
  },
};
