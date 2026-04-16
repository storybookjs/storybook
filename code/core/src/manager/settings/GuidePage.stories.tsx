import React from 'react';

import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';
import { initialState } from '../../shared/checklist-store/checklistData.state.ts';
import { internal_universalChecklistStore as mockStore } from '../manager-stores.mock.ts';
import { GuidePage } from './GuidePage.tsx';

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
    off: fn().mockName('api::off'),
    once: fn().mockName('api::once'),
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
  afterEach: async () => {
    delete (globalThis as any).STORYBOOK_LAST_EVENTS;
  },
});

export const Default = meta.story({});

export const AiCtaSkipped = meta.story({
  beforeEach: async () => {
    (globalThis as any).STORYBOOK_LAST_EVENTS = {
      'ai-init-opt-in': { body: {}, timestamp: Date.now() },
    };
    mockStore.setState({
      loaded: true,
      widget: {},
      items: {
        ...initialState.items,
        aiSetup: { status: 'skipped' },
        controls: { status: 'accepted' },
        renderComponent: { status: 'done' },
        viewports: { status: 'skipped' },
      },
    });
  },
});

export const AiCtaDone = meta.story({
  beforeEach: async () => {
    (globalThis as any).STORYBOOK_LAST_EVENTS = {
      'ai-init-opt-in': { body: {}, timestamp: Date.now() },
    };
    mockStore.setState({
      loaded: true,
      widget: {},
      items: {
        ...initialState.items,
        aiSetup: { status: 'done' },
        controls: { status: 'accepted' },
        renderComponent: { status: 'done' },
        viewports: { status: 'skipped' },
      },
    });
  },
});

export const AllDone = meta.story({
  beforeEach: async () => {
    const allDoneItems = Object.keys(initialState.items).reduce(
      (acc, key) => {
        acc[key as keyof typeof initialState.items] = { status: 'done' };
        return acc;
      },
      {} as Record<keyof typeof initialState.items, { status: string }>
    );
    mockStore.setState({
      loaded: true,
      widget: {},
      items: allDoneItems as typeof initialState.items,
    });
  },
});
