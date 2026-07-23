import React, { useContext, useMemo, useState, type ReactNode } from 'react';

import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { Location, MemoryRouter, parsePath, queryFromLocation } from 'storybook/internal/router';
import type { API_Notification } from 'storybook/internal/types';
import {
  ManagerContext,
  internal_fullStatusStore,
  registerService,
  type API,
  type State,
} from 'storybook/manager-api';

import preview from '../../../../../.storybook/preview.tsx';
import { reviewServiceDef } from '../../../shared/open-service/services/review/definition.ts';
import { LayoutProvider } from '../layout/LayoutProvider.tsx';
import { NotificationList } from '../notifications/NotificationList.tsx';
import { ReviewNotification } from './components/ReviewNotification.tsx';
import { ReviewProvider } from './components/ReviewProvider.tsx';
import { ReviewToolbarHeader } from './components/ReviewToolbarHeader.tsx';
import {
  NOTIFIED_REVIEW_CREATED_AT_KEY,
  VISITED_REVIEW_CREATED_AT_KEY,
  reviewAvailableNotificationId,
} from './constants.ts';
import { REVIEW_COLLECTION_QUERY_PARAM, buildReviewStoryHref } from './review-navigation.ts';
import type { ReviewState } from './review-state.ts';
import { reviewStore } from './review-store.ts';
import { ReviewSummaryHost } from './screens/ReviewSummaryHost.tsx';

const reviewService = registerService(reviewServiceDef);

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
const navigateMock = fn().mockName('api::navigate');
const setQueryParamsMock = fn().mockName('api::setQueryParams');
const addNotificationMock = fn().mockName('api::addNotification');
const clearNotificationMock = fn().mockName('api::clearNotification');
let mockUrlState = { path: '/review/', queryParams: {} as Record<string, string> };
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
  getNavAvailability: () => 'unavailable',
  getIsPanelShown: () => true,
  toggleNav: toggleNavMock,
  togglePanel: fn().mockName('api::togglePanel'),
  setAllTagFilters: fn().mockName('api::setAllTagFilters'),
  setAllStatusFilters: fn().mockName('api::setAllStatusFilters'),
  resetStatusFilters: fn().mockName('api::resetStatusFilters'),
  addStatusFilters: fn().mockName('api::addStatusFilters'),
  removeStatusFilters: fn().mockName('api::removeStatusFilters'),
  getStoryHrefs: (storyId: string, options?: { embed?: boolean; freeze?: boolean }) => ({
    managerHref: `?path=/story/${storyId}`,
    previewHref: `iframe.html?id=${storyId}&viewMode=story${options?.embed ? '&embed=true' : ''}${options?.freeze ? '&freeze=finished' : ''}`,
  }),
  navigate: navigateMock,
  setQueryParams: setQueryParamsMock,
  addNotification: addNotificationMock,
  clearNotification: clearNotificationMock,
  getUrlState: () => mockUrlState,
} as unknown as API;

const reviewState: ReviewState = {
  title: 'Manager settings polish',
  description: 'Updated settings views and spacing.',
  createdAt: new Date().getTime(),
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
  reviewStore.displayReview(reviewState);
};

const ReviewHarness = () => (
  <ReviewProvider>
    <ReviewToolbarHeader />
    <ReviewSummaryHost />
  </ReviewProvider>
);

const ReviewOutsideHarness = () => (
  <ReviewProvider>
    <ReviewNotification />
    <ReviewToolbarHeader />
    <ReviewSummaryHost />
  </ReviewProvider>
);

/** Renders sidebar notifications so review notification stories are visually accurate. */
const ReviewOutsideWithNotificationsHarness = () => {
  const parent = useContext(ManagerContext);
  const [notifications, setNotifications] = useState<API_Notification[]>([]);

  const api = useMemo(
    () => ({
      ...parent.api,
      addNotification: (notification: API_Notification) => {
        addNotificationMock(notification);
        setNotifications((current) => [
          ...current.filter((item) => item.id !== notification.id),
          notification,
        ]);
      },
      clearNotification: (id: string) => {
        clearNotificationMock(id);
        setNotifications((current) => current.filter((item) => item.id !== id));
      },
    }),
    [parent.api]
  );

  return (
    <ManagerContext.Provider value={{ state: parent.state, api }}>
      <LayoutProvider forceDesktop>
        <ReviewProvider>
          <ReviewNotification />
          <ReviewToolbarHeader />
          <ReviewSummaryHost />
        </ReviewProvider>
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            width: 240,
            zIndex: 200,
          }}
        >
          <NotificationList
            notifications={notifications}
            clearNotification={api.clearNotification}
          />
        </div>
      </LayoutProvider>
    </ManagerContext.Provider>
  );
};

const deriveViewMode = (path: string): State['viewMode'] => {
  const { viewMode } = parsePath(path);
  if (viewMode) {
    return viewMode as State['viewMode'];
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

      mockUrlState = { path, queryParams: customQueryParams };

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
      // Ignore the entire thumbnail cell, not just the iframe: the loading overlay and the
      // self-measuring iframe render nondeterministically (especially in Edge), and pixels
      // outside the iframe but inside the cell kept flagging spurious changes on every build.
      ignoreSelectors: ['[data-testid="review-collection-grid-cell"]'],
    },
  },
  decorators: [
    (Story, { parameters }) => (
      <MemoryRouter initialEntries={parameters?.routerInitialEntries ?? ['/?path=/review/']}>
        <ManagerStateSync parameters={parameters}>
          <div
            id="main-content-wrapper"
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              height: '100vh',
              minHeight: 0,
            }}
          >
            <Story />
          </div>
        </ManagerStateSync>
      </MemoryRouter>
    ),
  ],
  beforeEach: async () => {
    await reviewService.commands.dismissReview(undefined);
    reviewStore.reset();
    eventListeners.clear();
    onMock.mockReset();
    offMock.mockReset();
    emitMock.mockReset();
    toggleNavMock.mockReset();
    navigateMock.mockReset();
    setQueryParamsMock.mockReset();
    addNotificationMock.mockReset();
    clearNotificationMock.mockReset();
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
    return () => {
      internal_fullStatusStore.unset();
    };
  },
});

export const Collections = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Waiting for the agent/i)).toBeInTheDocument();

    await reviewService.commands.setReview(reviewState);

    await expect(await canvas.findByText('Manager settings polish')).toBeInTheDocument();
    await expect(await canvas.findByText('Settings')).toBeInTheDocument();
  },
});

export const StoryLinksUseCollectionParam = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    applyReviewState();

    const link = await canvas.findByRole('link', {
      name: 'Review story Guide Page – Default',
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

    applyReviewState();
    await expect(await canvas.findByText('Manager settings polish')).toBeInTheDocument();

    reviewStore.deferReview(updatedReviewState);

    await expect(await canvas.findByRole('status')).toBeInTheDocument();
    await expect(await canvas.findByRole('button', { name: 'Update' })).toBeInTheDocument();
    expect(canvas.getByText('Manager settings polish')).toBeInTheDocument();
    expect(canvas.queryByText('Updated manager settings polish')).not.toBeInTheDocument();
  },
});

export const PendingUpdateAccept = meta.story({
  render: () => <ReviewOutsideHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    applyReviewState();
    await expect(await canvas.findByText('Manager settings polish')).toBeInTheDocument();

    reviewStore.deferReview(updatedReviewState);
    clearNotificationMock.mockClear();
    addNotificationMock.mockClear();
    await expect(await canvas.findByRole('status')).toBeInTheDocument();
    await userEvent.click(await canvas.findByRole('button', { name: 'Update' }));

    await expect(await canvas.findByText('Updated manager settings polish')).toBeInTheDocument();
    expect(canvas.queryByText('A new review is available.')).not.toBeInTheDocument();
    await expect(clearNotificationMock).toHaveBeenCalledWith(
      reviewAvailableNotificationId(updatedReviewState.createdAt!)
    );
    expect(addNotificationMock).not.toHaveBeenCalled();
  },
});

export const PendingUpdateFromStoryNavigatesToSummary = meta.story({
  parameters: {
    // Clicking "Update" at the end of the play function swaps in a fresh review whose
    // preview-thumbnail iframes are still loading and self-measuring at capture time, so the
    // snapshot (in Edge especially) differs on nearly every build and had to be re-accepted
    // over and over. The flow itself is still covered as an interaction test.
    chromatic: { disableSnapshot: true },
    routerInitialEntries: ['/?path=/story/manager-settings-guidepage--default&collection=0'],
    managerState: {
      path: '/story/manager-settings-guidepage--default',
      viewMode: 'story',
      customQueryParams: { collection: '0' },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    applyReviewState();
    await expect(await canvas.findByRole('button', { name: /Select story/ })).toHaveTextContent(
      '2/3'
    );

    reviewStore.deferReview(updatedReviewState);

    await expect(await canvas.findByRole('status')).toBeInTheDocument();
    await userEvent.click(await canvas.findByRole('button', { name: 'Update' }));

    await expect(await canvas.findByText('Updated manager settings polish')).toBeInTheDocument();
    expect(canvas.queryByRole('button', { name: /Select story/ })).not.toBeInTheDocument();
  },
});

export const PendingUpdateSupersedesStale = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    applyReviewState();
    reviewStore.setStale(true);
    await expect(await canvas.findByText(/Code changes detected/)).toBeInTheDocument();

    reviewStore.deferReview(updatedReviewState);

    await expect(await canvas.findByRole('status')).toBeInTheDocument();
    await expect(await canvas.findByRole('button', { name: 'Update' })).toBeInTheDocument();
    expect(canvas.queryByText(/Code changes detected/)).not.toBeInTheDocument();
  },
});

export const ShowsNotificationForEachNewReview = meta.story({
  render: () => <ReviewOutsideHarness />,
  parameters: {
    routerInitialEntries: ['/?path=/story/manager-settings-guidepage--default'],
    managerState: {
      path: '/story/manager-settings-guidepage--default',
      viewMode: 'story',
    },
  },
  play: async () => {
    reviewStore.displayReview(reviewState);
    await waitFor(() =>
      expect(addNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: reviewAvailableNotificationId(reviewState.createdAt!),
        })
      )
    );

    addNotificationMock.mockClear();
    clearNotificationMock.mockClear();
    sessionStorage.setItem(VISITED_REVIEW_CREATED_AT_KEY, String(reviewState.createdAt));

    reviewStore.deferReview(updatedReviewState);
    await waitFor(() =>
      expect(clearNotificationMock).toHaveBeenCalledWith(
        reviewAvailableNotificationId(reviewState.createdAt!)
      )
    );
    await waitFor(() =>
      expect(addNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: reviewAvailableNotificationId(updatedReviewState.createdAt!),
          content: expect.objectContaining({ headline: 'New review available' }),
        })
      )
    );
  },
});

export const ShowsNotificationForUnseenReview = meta.story({
  render: () => <ReviewOutsideWithNotificationsHarness />,
  parameters: {
    routerInitialEntries: ['/?path=/story/manager-settings-guidepage--default'],
    managerState: {
      path: '/story/manager-settings-guidepage--default',
      viewMode: 'story',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    reviewStore.displayReview(reviewState);
    expect(navigateMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(addNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: reviewAvailableNotificationId(reviewState.createdAt!),
          content: expect.objectContaining({ headline: 'New review available' }),
        })
      )
    );
    await expect(await canvas.findByText('New review available')).toBeInTheDocument();
    expect(canvas.queryByText('A new review is available.')).not.toBeInTheDocument();
  },
});

export const DismissesNotificationOnReviewVisit = meta.story({
  render: () => <ReviewOutsideWithNotificationsHarness />,
  parameters: {
    routerInitialEntries: ['/?path=/review/'],
    managerState: {
      path: '/review/',
      viewMode: 'review',
    },
  },
  beforeEach: () => {
    sessionStorage.removeItem(NOTIFIED_REVIEW_CREATED_AT_KEY);
    sessionStorage.removeItem(VISITED_REVIEW_CREATED_AT_KEY);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    try {
      sessionStorage.setItem(NOTIFIED_REVIEW_CREATED_AT_KEY, String(reviewState.createdAt));
      reviewStore.displayReview(reviewState);
      await waitFor(() =>
        expect(clearNotificationMock).toHaveBeenCalledWith(
          reviewAvailableNotificationId(reviewState.createdAt!)
        )
      );
      expect(addNotificationMock).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(VISITED_REVIEW_CREATED_AT_KEY)).toBe(
        String(reviewState.createdAt)
      );
      expect(canvas.queryByText('New review available')).not.toBeInTheDocument();
    } finally {
      sessionStorage.removeItem(NOTIFIED_REVIEW_CREATED_AT_KEY);
      sessionStorage.removeItem(VISITED_REVIEW_CREATED_AT_KEY);
    }
  },
});

export const HidesNotificationAfterReviewVisited = meta.story({
  render: () => <ReviewOutsideHarness />,
  parameters: {
    routerInitialEntries: ['/?path=/story/manager-settings-guidepage--default'],
    managerState: {
      path: '/story/manager-settings-guidepage--default',
      viewMode: 'story',
    },
  },
  beforeEach: () => {
    sessionStorage.setItem(VISITED_REVIEW_CREATED_AT_KEY, String(reviewState.createdAt));
  },
  play: async () => {
    reviewStore.displayReview(reviewState);
    expect(addNotificationMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  },
});

export const NotificationClickFromStoryNavigatesAndDismisses = meta.story({
  render: () => <ReviewOutsideHarness />,
  parameters: {
    routerInitialEntries: ['/?path=/story/manager-settings-guidepage--default'],
    managerState: {
      path: '/story/manager-settings-guidepage--default',
      viewMode: 'story',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const freshReviewState = {
      ...reviewState,
      createdAt: reviewState.createdAt! + 120_000,
    };
    reviewStore.displayReview(freshReviewState);
    await waitFor(() =>
      expect(addNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: reviewAvailableNotificationId(freshReviewState.createdAt!),
        })
      )
    );

    const notification = addNotificationMock.mock.calls[0][0];
    clearNotificationMock.mockClear();
    addNotificationMock.mockClear();

    notification.onClick({ onDismiss: () => clearNotificationMock(notification.id) });

    await expect(await canvas.findByText('Manager settings polish')).toBeInTheDocument();
    await expect(clearNotificationMock).toHaveBeenCalledWith(
      reviewAvailableNotificationId(freshReviewState.createdAt!)
    );
    expect(addNotificationMock).not.toHaveBeenCalled();
    reviewStore.setStale(false);
    expect(addNotificationMock).not.toHaveBeenCalled();
  },
});

export const SummaryStateSurvivesReviewReplay = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    applyReviewState();

    const collapseButton = await canvas.findByRole('button', {
      name: 'Collapse collection Settings',
    });
    await userEvent.click(collapseButton);
    await expect(
      await canvas.findByRole('button', { name: 'Expand collection Settings' })
    ).toHaveAttribute('aria-expanded', 'false');

    // An equivalent OSA state emission must not reset local summary UI state.
    reviewStore.setStale(false);

    await expect(
      canvas.getByRole('button', { name: 'Expand collection Settings' })
    ).toHaveAttribute('aria-expanded', 'false');
  },
});
