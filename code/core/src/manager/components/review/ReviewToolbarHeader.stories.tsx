import type { ReactNode } from 'react';

import { expect, fn, within } from 'storybook/test';

import {
  ManagerContext,
  type API,
  type State,
  internal_fullStatusStore,
} from 'storybook/manager-api';
import { MemoryRouter } from 'storybook/internal/router';

import preview from '../../../../../.storybook/preview.tsx';
import { ADDON_ID, EVENTS } from './constants.ts';
import { ReviewProvider } from './ReviewProvider.tsx';
import { ReviewToolbarHeader } from './ReviewToolbarHeader.tsx';
import { buildReviewChangesSummaryHref, buildReviewStoryHref } from './review-navigation.ts';
import type { ReviewState } from './review-state.ts';
import { useReviewShortcuts } from './useReviewShortcuts.ts';

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
const setAddonShortcutMock = fn();

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

const applyReviewState = () => {
  expect(onMock).toHaveBeenCalledWith(EVENTS.DISPLAY_REVIEW, expect.any(Function));
  emitMock(EVENTS.DISPLAY_REVIEW, reviewState);
};

const managerStateBase: State = {
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
  getIsPanelShown: () => true,
  toggleNav: toggleNavMock,
  togglePanel: fn().mockName('api::togglePanel'),
  setAddonShortcut: setAddonShortcutMock,
  setQueryParams: fn(),
  setAllTagFilters: fn().mockName('api::setAllTagFilters'),
  setAllStatusFilters: fn().mockName('api::setAllStatusFilters'),
  resetStatusFilters: fn().mockName('api::resetStatusFilters'),
  addStatusFilters: fn().mockName('api::addStatusFilters'),
  removeStatusFilters: fn().mockName('api::removeStatusFilters'),
  getStoryHrefs: (storyId: string, options?: { embed?: boolean; freeze?: boolean }) => ({
    managerHref: `?path=/story/${storyId}`,
    previewHref: `iframe.html?id=${storyId}&viewMode=story${options?.embed ? '&embed=true' : ''}${options?.freeze ? '&freeze=finished' : ''}`,
  }),
} as unknown as API;

const meta = preview.meta({
  component: ReviewToolbarHeader,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story, { parameters }) => (
      <ManagerContext.Provider
        value={{
          state: {
            ...managerStateBase,
            ...(parameters?.managerState ?? {}),
          },
          api: managerApi,
        }}
      >
        <MemoryRouter initialEntries={parameters?.routerInitialEntries ?? ['/']}>
          <ReviewProvider>
            <ReviewShortcutsHarness>
              <Story />
            </ReviewShortcutsHarness>
          </ReviewProvider>
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
    setAddonShortcutMock.mockReset();
    sessionStorage.clear();
    internal_fullStatusStore.unset();
  },
});

const ReviewShortcutsHarness = ({ children }: { children: ReactNode }) => {
  useReviewShortcuts();
  return children;
};

export const OnReviewedStory = meta.story({
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
    applyReviewState();

    const counter = await canvas.findByRole('button', { name: 'Open story list' });
    await expect(counter).toHaveTextContent('2/3');
    await expect(setAddonShortcutMock).toHaveBeenCalledWith(
      ADDON_ID,
      expect.objectContaining({
        actionName: 'reviewNextStory',
        defaultShortcut: ['ArrowRight'],
      })
    );
    await expect(await canvas.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    await expect(await canvas.findByRole('link', { name: 'Back to review' })).toHaveAttribute(
      'href',
      buildReviewChangesSummaryHref()
    );
    await expect(canvas.queryByText('New')).not.toBeInTheDocument();
  },
});

export const Progress = meta.story({
  parameters: {
    routerInitialEntries: ['/?path=/story/manager-settings-aboutscreen--default&collection=0'],
    managerState: {
      path: '/story/manager-settings-aboutscreen--default',
      viewMode: 'story',
      customQueryParams: { collection: '0' },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    applyReviewState();

    const counter = await canvas.findByRole('button', { name: 'Open story list' });
    await expect(counter).toHaveTextContent('3/3');
    const fill = await canvas.findByTestId<HTMLElement>('review-progress-fill');
    await expect(Math.round(parseFloat(fill.style.width))).toBe(100);
  },
});

export const NewStory = meta.story({
  parameters: {
    routerInitialEntries: ['/?path=/story/manager-settings-checklist--default&collection=0'],
    managerState: {
      path: '/story/manager-settings-checklist--default',
      viewMode: 'story',
      customQueryParams: { collection: '0' },
    },
  },
  // A story is "newly added" when change detection reports it as new.
  beforeEach: () => {
    internal_fullStatusStore.set([
      {
        storyId: 'manager-settings-checklist--default',
        typeId: 'storybook/change-detection',
        value: 'status-value:new',
        title: 'Change Detection',
        description: '',
      },
    ]);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    applyReviewState();

    await expect(await canvas.findByText('New')).toBeInTheDocument();
    await expect(await canvas.findByRole('link', { name: 'Next story' })).toHaveAttribute(
      'href',
      buildReviewStoryHref({
        collectionIndex: 0,
        storyId: 'manager-settings-guidepage--default',
      })
    );
  },
});
