import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { universalChecklistStore as mockStore } from '../../manager-stores.mock';
import { ChecklistModule } from './ChecklistModule';

const managerContext: any = {
  state: {},
  api: {
    navigateUrl: fn().mockName('api::navigateUrl'),
  },
};

const meta = preview.meta({
  component: ChecklistModule,
  decorators: [
    (Story) => (
      <ManagerContext.Provider value={managerContext}>
        <div style={{ width: 250 }}>{Story()}</div>
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
