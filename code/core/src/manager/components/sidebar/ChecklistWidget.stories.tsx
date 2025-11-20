import type { PlayFunction } from 'storybook/internal/csf';

import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { internal_universalChecklistStore as mockStore } from '../../manager-stores.mock';
import { ChecklistWidget } from './ChecklistWidget';

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
  component: ChecklistWidget,
  decorators: [
    (Story) => (
      <ManagerContext.Provider value={managerContext}>
        <div style={{ width: 300, height: 250 }}>{Story()}</div>
      </ManagerContext.Provider>
    ),
  ],
  beforeEach: async () => {
    mockStore.setState({
      loaded: true,
      widget: {},
      values: {
        controls: { status: 'accepted' },
        'render-component': { status: 'done' },
        'more-components': { status: 'skipped' },
        'more-stories': { status: 'skipped' },
      },
    });
  },
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const play: PlayFunction = async ({ step }) => {
  await wait(3000);
  await step('Complete viewports task', () => {
    mockStore.setState({
      loaded: true,
      widget: {},
      values: {
        controls: { status: 'accepted' },
        'render-component': { status: 'done' },
        viewports: { status: 'done' },
        'more-components': { status: 'skipped' },
        'more-stories': { status: 'skipped' },
      },
    });
  });

  await wait(1000);
  await step('Skip install-vitest task', () => {
    mockStore.setState({
      loaded: true,
      widget: {},
      values: {
        controls: { status: 'accepted' },
        'render-component': { status: 'done' },
        viewports: { status: 'done' },
        'more-components': { status: 'skipped' },
        'more-stories': { status: 'skipped' },
        'install-vitest': { status: 'skipped' },
      },
    });
  });
};

export const Default = meta.story({
  play,
});

export const Narrow = meta.story({
  decorators: [(Story) => <div style={{ width: 200, height: 250 }}>{Story()}</div>],
  play,
});
