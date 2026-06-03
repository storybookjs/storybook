import { expect, fn, userEvent, within } from 'storybook/test';

import {
  ManagerContext,
  type API,
  type State,
  internal_fullStatusStore,
} from 'storybook/manager-api';
import { MemoryRouter } from 'storybook/internal/router';

import preview from '../../../.storybook/preview.tsx';
import { EVENTS, RESTORE_NAV_SESSION_KEY } from './constants.ts';
import type { ReviewState } from './review-state.ts';
import { ReviewPage } from './ReviewPage.ts';
import { sessionStore } from './session-store.ts';

type EventListener = (payload?: unknown) => void;

const eventListeners = new Map<string, Set<EventListener>>();
const removeEventListener = (eventName: string, listener: EventListener) => {
  eventListeners.get(eventName)?.delete(listener);
};
const onMock = fn((eventName: string, listener: EventListener): (() => void) => {
  if (!eventListeners.has(eventName)) {
    eventListeners.set(eventName, new Set());
  }
  eventListeners.get(eventName)?.add(listener);
  return () => removeEventListener(eventName, listener);
});
const offMock = fn((eventName: string, listener: EventListener) => {
  removeEventListener(eventName, listener);
});
const emitMock = fn((eventName: string, payload?: unknown) => {
  eventListeners.get(eventName)?.forEach((listener) => {
    listener(payload);
  });
});
const toggleNavMock = fn();
const managerState: State = {
  index: {
    'manager-settings-checklist--default': {
      type: 'story',
      id: 'manager-settings-checklist--default',
      title: 'Manager/Settings/Checklist',
      name: 'Default',
    },
    'manager-settings-guidepage--default': {
      type: 'story',
      id: 'manager-settings-guidepage--default',
      title: 'Manager/Settings/Guide Page',
      name: 'Default',
    },
    'manager-settings-aboutscreen--default': {
      type: 'story',
      id: 'manager-settings-aboutscreen--default',
      title: 'Manager/Settings/About Screen',
      name: 'Default',
    },
  },
} as unknown as State;
const managerApi: API = {
  on: onMock,
  off: offMock,
  emit: emitMock,
  getIsNavShown: () => true,
  toggleNav: toggleNavMock,
} as unknown as API;

const reviewState: ReviewState = {
  title: 'Manager settings polish',
  description: 'Updated settings views and spacing.',
  branchName: 'feat/review-page',
  // Drives the baseline-index fetch (keyed on createdAt) for "New" detection.
  createdAt: 1_700_000_000_000,
  collections: [
    {
      title: 'Settings',
      rationale: 'Primary settings surfaces changed.',
      storyIds: [
        'manager-settings-checklist--default',
        'manager-settings-guidepage--default',
        'manager-settings-aboutscreen--default',
      ],
    },
  ],
};

// Baseline index served via the dev-server proxy. Intentionally omits
// `manager-settings-checklist--default` so it reads as a newly added story,
// while guidepage/aboutscreen already exist in the baseline.
const baselineIndex = {
  v: 5,
  entries: {
    'manager-settings-guidepage--default': {
      type: 'story',
      id: 'manager-settings-guidepage--default',
      title: 'Manager/Settings/Guide Page',
      name: 'Default',
    },
    'manager-settings-aboutscreen--default': {
      type: 'story',
      id: 'manager-settings-aboutscreen--default',
      title: 'Manager/Settings/About Screen',
      name: 'Default',
    },
  },
};

const originalFetch = globalThis.fetch;
const fetchMock = fn(async (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === 'string' ? input : input.toString();
  if (url.includes('/__review-baseline/index.json')) {
    return new Response(JSON.stringify(baselineIndex), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(null, { status: 404 });
});

const applyReviewState = () => {
  expect(onMock).toHaveBeenCalledWith(EVENTS.DISPLAY_REVIEW, expect.any(Function));
  emitMock(EVENTS.DISPLAY_REVIEW, reviewState);
};

const meta = preview.meta({
  component: ReviewPage,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story, { parameters }) => (
      <ManagerContext.Provider
        value={{
          state: managerState,
          api: managerApi,
        }}
      >
        <MemoryRouter initialEntries={parameters?.routerInitialEntries ?? ['/']}>
          <Story />
        </MemoryRouter>
      </ManagerContext.Provider>
    ),
  ],
  beforeEach: () => {
    eventListeners.clear();
    onMock.mockReset();
    offMock.mockReset();
    emitMock.mockReset();
    toggleNavMock.mockReset();
    fetchMock.mockClear();
    sessionStore.remove(RESTORE_NAV_SESSION_KEY);
    // Reset change-detection statuses so a story marking one "new" doesn't leak
    // into stories that assert the absence of the badge.
    internal_fullStatusStore.unset();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    return () => {
      globalThis.fetch = originalFetch;
    };
  },
});

export const Collections = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Waiting for the agent/i)).toBeInTheDocument();
    await expect(emitMock).toHaveBeenCalledWith(EVENTS.REQUEST_REVIEW);

    applyReviewState();

    await expect(await canvas.findByText('Manager settings polish')).toBeInTheDocument();
    await expect(await canvas.findByRole('tab', { name: 'Collections' })).toBeInTheDocument();
  },
});

export const Components = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(emitMock).toHaveBeenCalledWith(EVENTS.REQUEST_REVIEW);

    applyReviewState();

    const componentsTab = await canvas.findByRole('tab', { name: 'Components' });
    await userEvent.click(componentsTab);
  },
});

export const Details = meta.story({
  parameters: {
    routerInitialEntries: ['/?path=/review/collections/0/manager-settings-guidepage--default'],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(emitMock).toHaveBeenCalledWith(EVENTS.REQUEST_REVIEW);

    applyReviewState();

    await expect(await canvas.findByRole('button', { name: '2/3' })).toBeInTheDocument();
    await expect(
      await canvas.findByTitle('Latest manager-settings-guidepage--default')
    ).toBeInTheDocument();
    // guidepage exists in the baseline index, so it must not be flagged "New".
    await expect(canvas.queryByText('New')).not.toBeInTheDocument();
  },
});

export const DetailsNewStory = meta.story({
  parameters: {
    routerInitialEntries: ['/?path=/review/collections/0/manager-settings-checklist--default'],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(emitMock).toHaveBeenCalledWith(EVENTS.REQUEST_REVIEW);

    applyReviewState();

    await expect(
      await canvas.findByTitle('Latest manager-settings-checklist--default')
    ).toBeInTheDocument();
    // checklist is absent from the baseline index, so it is newly added.
    await expect(await canvas.findByText('New')).toBeInTheDocument();
  },
});

export const DetailsChangeDetectedNew = meta.story({
  parameters: {
    routerInitialEntries: ['/?path=/review/collections/0/manager-settings-guidepage--default'],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // guidepage exists in the baseline index, so the baseline check alone would
    // not flag it. Mark it new via the change-detection status store instead.
    internal_fullStatusStore.set([
      {
        storyId: 'manager-settings-guidepage--default',
        typeId: 'storybook/change-detection',
        value: 'status-value:new',
        title: 'Change Detection',
        description: '',
      },
    ]);

    await expect(emitMock).toHaveBeenCalledWith(EVENTS.REQUEST_REVIEW);

    applyReviewState();

    await expect(
      await canvas.findByTitle('Latest manager-settings-guidepage--default')
    ).toBeInTheDocument();
    // Flagged "New" by change-detection despite existing in the baseline.
    await expect(await canvas.findByText('New')).toBeInTheDocument();
  },
});
