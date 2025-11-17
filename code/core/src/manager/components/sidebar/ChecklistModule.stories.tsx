import type { PlayFunction } from 'storybook/internal/csf';

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
      done: ['render-component'],
      skipped: ['more-components', 'more-stories'],
    });
  },
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const play: PlayFunction = async ({ step }) => {
  await wait(3000);
  await step('Complete viewports task', () => {
    mockStore.setState({
      loaded: true,
      muted: false,
      accepted: ['controls'],
      done: ['render-component', 'viewports'],
      skipped: ['more-components', 'more-stories'],
    });
  });

  await wait(1000);
  await step('Skip install-vitest task', () => {
    mockStore.setState({
      loaded: true,
      muted: false,
      accepted: ['controls'],
      done: ['render-component', 'viewports'],
      skipped: ['more-components', 'more-stories', 'install-vitest'],
    });
  });
};

export const Default = meta.story({
  play,
});

export const Narrow = meta.story({
  decorators: [(Story) => <div style={{ maxWidth: 200 }}>{Story()}</div>],
  play,
});
