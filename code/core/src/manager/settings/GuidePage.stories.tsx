import React from 'react';

import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';

import preview from '../../../../.storybook/preview';
import { internal_universalChecklistStore as mockStore } from '../manager-stores.mock';
import { GuidePage } from './GuidePage';

const managerContext: any = {
  state: {},
  api: {
    getData: fn().mockName('api::getData'),
    getIndex: fn().mockName('api::getIndex'),
    getUrlState: fn().mockName('api::getUrlState'),
    navigate: fn().mockName('api::navigate'),
    on: fn().mockName('api::on'),
  },
};

const meta = preview.meta({
  component: GuidePage,
  decorators: [
    (Story) => (
      <ManagerContext.Provider value={managerContext}>
        <Story />
      </ManagerContext.Provider>
    ),
  ],
  beforeEach: async () => {
    mockStore.setState({
      loaded: true,
      muted: false,
      accepted: ['controls'],
      done: ['add-component'],
      skipped: ['viewports'],
    });
  },
});

export const Default = meta.story({});
