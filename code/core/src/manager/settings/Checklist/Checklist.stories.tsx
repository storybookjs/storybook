import React from 'react';

import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';
import { styled } from 'storybook/theming';

import preview from '../../../../../.storybook/preview';
import { universalChecklistStore as mockStore } from '../../manager-stores.mock';
import { Checklist } from './Checklist';
import { checklistData } from './checklistData';

const Container = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2,
}));

const managerContext: any = {
  state: {},
  api: {
    navigateUrl: fn().mockName('api::navigateUrl'),
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
  beforeEach: async () => {
    mockStore.setState({
      muted: false,
      completed: ['add-component'],
      skipped: ['add-5-10-components'],
    });
  },
});

export const Default = meta.story({
  args: {
    data: checklistData,
  },
});
