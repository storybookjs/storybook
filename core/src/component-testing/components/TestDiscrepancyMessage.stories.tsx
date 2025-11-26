import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';

import { CallStates } from '../../instrumenter/types';
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
