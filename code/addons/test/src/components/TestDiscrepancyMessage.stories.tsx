import React from 'react';

import { ManagerContext } from 'storybook/internal/manager-api';

import { CallStates } from '@storybook/instrumenter';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { TestDiscrepancyMessage } from './TestDiscrepancyMessage';

type Story = StoryObj<typeof TestDiscrepancyMessage>;
const managerContext: any = {
  state: {},
  api: {
    getDocsUrl: fn().mockName('api::getDocsUrl'),
    emit: fn().mockName('api::emit'),
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
    browserTestStatus: CallStates.DONE,
  },
};

export const CliFailedBrowserPassed: Story = {
  args: {
    browserTestStatus: CallStates.ERROR,
  },
};
