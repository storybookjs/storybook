import React from 'react';

import { internal_checklistStore as checklistStore } from '#manager-stores';
import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';
import { styled } from 'storybook/theming';

import preview from '../../../../../.storybook/preview';
import { Checklist } from './Checklist';
import { checklistData } from './checklistData';

const Container = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2,
}));

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
  component: Checklist,
  decorators: [
    (Story) => (
      <ManagerContext.Provider value={managerContext}>
        <Container>
          <Story />
        </Container>
      </ManagerContext.Provider>
    ),
  ],
});

export const Default = meta.story({
  args: {
    ...checklistData,
    ...checklistStore,
    accepted: ['controls'],
    done: ['install-storybook', 'render-component', 'whats-new-storybook-10'],
    skipped: ['viewports'],
  },
});
