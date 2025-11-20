import React from 'react';

import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';

import preview from '../../../../.storybook/preview';
import { initialState } from '../../shared/checklist-store/checklistData.state';
import { internal_universalChecklistStore as mockStore } from '../manager-stores.mock';
import { GuidePage } from './GuidePage';

const managerContext: any = {
  state: {},
  api: {
    getDocsUrl: fn(
      ({ asset, subpath }) =>
        // TODO: Remove hard-coded version. Should be `major.minor` of latest release.
        `https://storybook.js.org/${asset ? 'docs-assets/10.0' : 'docs'}/${subpath}`
    ).mockName('api::getDocsUrl'),
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
      widget: {},
      items: {
        ...initialState.items,
        controls: { status: 'accepted' },
        renderComponent: { status: 'done' },
        viewports: { status: 'skipped' },
      },
    });
  },
});

export const Default = meta.story({});
