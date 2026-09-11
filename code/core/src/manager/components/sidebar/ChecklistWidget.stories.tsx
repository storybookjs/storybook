import type { PlayFunction } from 'storybook/internal/csf';

import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, within } from 'storybook/test';

import preview from '../../../../../.storybook/preview.tsx';
import { initialState } from '../../../shared/checklist-store/checklistData.state.ts';
import { internal_universalChecklistStore as mockStore } from '../../manager-stores.mock.ts';
import { ChecklistWidget } from './ChecklistWidget.tsx';

const managerContext: any = {
  state: {},
  api: {
    getIsNavShown: () => true,
    getData: fn().mockName('api::getData'),
    getIndex: fn().mockName('api::getIndex'),
    getUrlState: fn().mockName('api::getUrlState'),
    navigate: fn().mockName('api::navigate'),
    on: fn().mockName('api::on'),
    off: fn().mockName('api::off'),
    once: fn().mockName('api::once'),
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
      items: {
        ...initialState.items,
        controls: { status: 'accepted' },
        renderComponent: { status: 'done' },
        installVitest: { status: 'done' },
        moreComponents: { status: 'skipped' },
        moreStories: { status: 'skipped' },
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
      items: {
        ...initialState.items,
        controls: { status: 'accepted' },
        renderComponent: { status: 'done' },
        installVitest: { status: 'done' },
        viewports: { status: 'done' },
        moreComponents: { status: 'skipped' },
        moreStories: { status: 'skipped' },
      },
    });
  });

  await wait(1000);
  await step('Skip installVitest task', () => {
    mockStore.setState({
      loaded: true,
      widget: {},
      items: {
        ...initialState.items,
        controls: { status: 'accepted' },
        renderComponent: { status: 'done' },
        installVitest: { status: 'done' },
        viewports: { status: 'done' },
        moreComponents: { status: 'skipped' },
        moreStories: { status: 'skipped' },
        writeInteractions: { status: 'skipped' },
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

const withAiSetupState = {
  loaded: true,
  aiOptIn: true,
  aiSetupRun: true,
  widget: {},
  items: {
    ...initialState.items,
    // aiSetup is intentionally left 'open' so it appears in the widget's task list
    controls: { status: 'accepted' as const },
    renderComponent: { status: 'done' as const },
  },
};

export const WithAiSetup = meta.story({
  beforeEach: async () => {
    mockStore.setState(withAiSetupState);
  },
});

export const StableAcrossStateSyncs = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByRole('listitem');
    // Wait for the widget's animated mode and the initial enter transitions to settle.
    await wait(3000);
    const rows = [...canvasElement.querySelectorAll('li')];
    await expect(rows.length).toBeGreaterThan(0);

    mockStore.setState((state) => ({ ...state, items: { ...state.items } }));
    let minOpacity = 1;
    const start = performance.now();
    while (performance.now() - start < 500) {
      for (const row of rows) {
        minOpacity = Math.min(minOpacity, parseFloat(getComputedStyle(row).opacity));
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    await expect(minOpacity).toBe(1);
    for (const row of rows) {
      await expect(canvasElement.contains(row)).toBe(true);
    }
  },
});
