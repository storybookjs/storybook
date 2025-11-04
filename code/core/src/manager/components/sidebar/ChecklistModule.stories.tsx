import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { internal_universalChecklistStore as mockStore } from '../../manager-stores.mock';
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
        <div style={{ maxWidth: 300 }}>{Story()}</div>
      </ManagerContext.Provider>
    ),
  ],
  beforeEach: async () => {
    mockStore.setState({
      loaded: true,
      muted: false,
      accepted: ['controls'],
      done: ['install-storybook', 'render-component', 'whats-new-storybook-10'],
      skipped: ['more-components', 'more-stories'],
    });
  },
});

export const Default = meta.story({});

export const Narrow = meta.story({
  decorators: [(Story) => <div style={{ maxWidth: 200 }}>{Story()}</div>],
});
