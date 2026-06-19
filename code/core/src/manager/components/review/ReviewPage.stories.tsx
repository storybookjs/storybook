import React, { type ReactNode } from 'react';

import { expect, fn, userEvent, within } from 'storybook/test';

import {
  ManagerContext,
  type API,
  type State,
  internal_fullStatusStore,
} from 'storybook/manager-api';
import { Location, MemoryRouter, parsePath, queryFromLocation } from 'storybook/internal/router';

import preview from '../../../../../.storybook/preview.tsx';
import { EVENTS } from './constants.ts';
import { ReviewProvider } from './ReviewProvider.tsx';
import { ReviewSummaryPortal } from './ReviewSummaryPortal.tsx';
import { ReviewToolbarHeader } from './ReviewToolbarHeader.tsx';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  buildReviewStoryHref,
  isReviewSummaryPath,
} from './review-navigation.ts';
import type { ReviewState } from './review-state.ts';

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
  path: '/review/',
  viewMode: 'review',
  customQueryParams: {},
} as unknown as State;
const managerApi: API = {
  on: onMock,
  off: offMock,
  emit: emitMock,
  getIsNavShown: () => true,
  getIsPanelShown: () => true,
  toggleNav: toggleNavMock,
  togglePanel: fn().mockName('api::togglePanel'),
  setAllTagFilters: fn().mockName('api::setAllTagFilters'),
  setAllStatusFilters: fn().mockName('api::setAllStatusFilters'),
  resetStatusFilters: fn().mockName('api::resetStatusFilters'),
  addStatusFilters: fn().mockName('api::addStatusFilters'),
  removeStatusFilters: fn().mockName('api::removeStatusFilters'),
  getStoryHrefs: (storyId: string, options?: { freeze?: boolean }) => ({
    managerHref: `?path=/story/${storyId}`,
    previewHref: `iframe.html?id=${storyId}&viewMode=story${options?.freeze ? '&freeze=finished' : ''}`,
  }),
} as unknown as API;

const reviewState: ReviewState = {
  title: 'Manager settings polish',
  description: 'Updated settings views and spacing.',
  createdAt: Date.now(),
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

const updatedReviewState: ReviewState = {
  ...reviewState,
  title: 'Updated manager settings polish',
  description: 'Refreshed review after more changes.',
  createdAt: reviewState.createdAt! + 60_000,
};

const applyReviewState = () => {
  expect(onMock).toHaveBeenCalledWith(EVENTS.DISPLAY_REVIEW, expect.any(Function));
  emitMock(EVENTS.DISPLAY_REVIEW, reviewState);
};

const ReviewHarness = () => (
  <ReviewProvider>
    <ReviewToolbarHeader />
    <ReviewSummaryPortal />
  </ReviewProvider>
);

const deriveViewMode = (path: string): State['viewMode'] => {
  if (path.startsWith('/story/') || path.startsWith('/docs/')) {
    return parsePath(path).viewMode as State['viewMode'];
  }
  if (isReviewSummaryPath(path)) {
    return 'review';
  }
  return managerState.viewMode;
};

/** Keep ManagerContext path/viewMode in sync with MemoryRouter navigations in play tests. */
const ManagerStateSync = ({
  children,
  parameters,
}: {
  children: ReactNode;
  parameters?: { managerState?: Partial<State> };
}) => (
  <Location>
    {({ location, path }) => {
      const query = queryFromLocation(location);
      const customQueryParams: Record<string, string> = {};
      if (query[REVIEW_COLLECTION_QUERY_PARAM] !== undefined) {
        customQueryParams[REVIEW_COLLECTION_QUERY_PARAM] = String(
          query[REVIEW_COLLECTION_QUERY_PARAM]
        );
      }

      const state = {
        ...managerState,
        ...(parameters?.managerState ?? {}),
        path,
        viewMode: deriveViewMode(path),
        customQueryParams,
      } as State;

      return (
        <ManagerContext.Provider value={{ state, api: managerApi }}>
          {children}
        </ManagerContext.Provider>
      );
    }}
  </Location>
);

const meta = preview.meta({
  component: ReviewHarness,
  parameters: {
    layout: 'fullscreen',
    chromatic: {
      ignoreSelectors: ['[data-testid="review-collection-grid-cell"] iframe'],
    },
  },
  decorators: [
    (Story, { parameters }) => (
      <MemoryRouter initialEntries={parameters?.routerInitialEntries ?? ['/?path=/review/']}>
        <ManagerStateSync parameters={parameters}>
          <div
            id="main-content-wrapper"
            style={{ display: 'flex', flexDirection: 'column', height: '100vh', minHeight: 0 }}
          >
            <Story />
          </div>
        </ManagerStateSync>
      </MemoryRouter>
    ),
  ],
  beforeEach: () => {
    eventListeners.clear();
    onMock.mockReset();
    offMock.mockReset();
    emitMock.mockReset();
    toggleNavMock.mockReset();
    sessionStorage.clear();
    internal_fullStatusStore.unset();
    // Mark one reviewed story as newly added (via change detection) so the
    // summary shows the "New" badge.
    internal_fullStatusStore.set([
      {
        storyId: 'manager-settings-checklist--default',
        typeId: 'storybook/change-detection',
        value: 'status-value:new',
        title: 'Change Detection',
        description: '',
      },
    ]);
    document.getElementById('storybook-review-summary-portal')?.remove();
    return () => {
      internal_fullStatusStore.unset();
      document.getElementById('storybook-review-summary-portal')?.remove();
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
    await expect(await canvas.findByText('Settings')).toBeInTheDocument();
  },
});

export const StoryLinksUseCollectionParam = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    applyReviewState();

    const link = await canvas.findByRole('link', {
      name: 'Review story manager-settings-guidepage--default',
    });
    expect(link.getAttribute('href')).toBe(
      buildReviewStoryHref({
        collectionIndex: 0,
        storyId: 'manager-settings-guidepage--default',
      })
    );
    expect(link.getAttribute('href')).toContain(`${REVIEW_COLLECTION_QUERY_PARAM}=0`);
  },
});

export const PendingUpdateDeferred = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(emitMock).toHaveBeenCalledWith(EVENTS.REQUEST_REVIEW);

    applyReviewState();
    await expect(await canvas.findByText('Manager settings polish')).toBeInTheDocument();

    emitMock(EVENTS.DISPLAY_REVIEW, updatedReviewState);

    await expect(await canvas.findByRole('status')).toBeInTheDocument();
    await expect(await canvas.findByRole('button', { name: 'Switch' })).toBeInTheDocument();
    expect(canvas.getByText('Manager settings polish')).toBeInTheDocument();
    expect(canvas.queryByText('Updated manager settings polish')).not.toBeInTheDocument();
  },
});

export const PendingUpdateAccept = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(emitMock).toHaveBeenCalledWith(EVENTS.REQUEST_REVIEW);

    applyReviewState();
    await expect(await canvas.findByText('Manager settings polish')).toBeInTheDocument();

    emitMock(EVENTS.DISPLAY_REVIEW, updatedReviewState);

    await expect(await canvas.findByRole('status')).toBeInTheDocument();
    await userEvent.click(await canvas.findByRole('button', { name: 'Switch' }));

    await expect(await canvas.findByText('Updated manager settings polish')).toBeInTheDocument();
    expect(canvas.queryByText('An updated review is available.')).not.toBeInTheDocument();
  },
});

export const PendingUpdateFromStoryNavigatesToSummary = meta.story({
  parameters: {
    routerInitialEntries: ['/?path=/story/manager-settings-guidepage--default&collection=0'],
    managerState: {
      path: '/story/manager-settings-guidepage--default',
      viewMode: 'story',
      customQueryParams: { collection: '0' },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(emitMock).toHaveBeenCalledWith(EVENTS.REQUEST_REVIEW);

    applyReviewState();
    await expect(await canvas.findByRole('button', { name: 'Open story list' })).toHaveTextContent(
      '2/3'
    );

    emitMock(EVENTS.DISPLAY_REVIEW, updatedReviewState);

    await expect(await canvas.findByRole('status')).toBeInTheDocument();
    await userEvent.click(await canvas.findByRole('button', { name: 'Switch' }));

    await expect(await canvas.findByText('Updated manager settings polish')).toBeInTheDocument();
    expect(canvas.queryByRole('button', { name: 'Open story list' })).not.toBeInTheDocument();
  },
});

export const PendingUpdateSupersedesStale = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(emitMock).toHaveBeenCalledWith(EVENTS.REQUEST_REVIEW);

    applyReviewState();
    emitMock(EVENTS.REVIEW_STALE);
    await expect(await canvas.findByText(/Code changes detected/)).toBeInTheDocument();

    emitMock(EVENTS.DISPLAY_REVIEW, updatedReviewState);

    await expect(await canvas.findByRole('status')).toBeInTheDocument();
    await expect(await canvas.findByRole('button', { name: 'Switch' })).toBeInTheDocument();
    expect(canvas.queryByText(/Code changes detected/)).not.toBeInTheDocument();
  },
});
