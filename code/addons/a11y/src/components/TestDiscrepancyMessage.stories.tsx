import React from 'react';

import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';

import preview from '../../../../.storybook/preview';
import { TestDiscrepancyMessage } from './TestDiscrepancyMessage';

const managerContext: any = {
  state: {},
  api: {
    getDocsUrl: fn().mockName('api::getDocsUrl'),
    getCurrentParameter: fn().mockName('api::getCurrentParameter'),
  },
};

const meta = preview.meta({
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
});

export const BrowserPassedCliFailed = meta.story({
  args: {
    discrepancy: 'browserPassedCliFailed',
  },
});

export const CliPassedBrowserFailed = meta.story({
  args: {
    discrepancy: 'cliPassedBrowserFailed',
  },
});

export const CliFailedButModeManual = meta.story({
  args: {
    discrepancy: 'cliFailedButModeManual',
  },
});
