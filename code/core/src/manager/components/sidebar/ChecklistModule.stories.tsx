import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { internal_universalChecklistStore as mockStore } from '../../manager-stores.mock';
import { ChecklistModule } from './ChecklistModule';

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
      done: ['install-storybook', 'render-component'],
      skipped: ['more-components', 'more-stories'],
    });
  },
});

export const Default = meta.story({
  play: () => {
    setTimeout(() => {
      mockStore.setState({
        loaded: true,
        muted: false,
        accepted: ['controls'],
        done: ['install-storybook', 'render-component', 'viewports'],
        skipped: ['more-components', 'more-stories'],
      });
    }, 4000);
    setTimeout(() => {
      mockStore.setState({
        loaded: true,
        muted: false,
        accepted: ['controls'],
        done: ['install-storybook', 'render-component', 'viewports'],
        skipped: ['more-components', 'more-stories', 'install-vitest'],
      });
    }, 8000);
  },
});

export const Narrow = meta.story({
  decorators: [(Story) => <div style={{ maxWidth: 200 }}>{Story()}</div>],
});
