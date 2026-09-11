import React from 'react';

import { CHANGE_DETECTION_STATUS_TYPE_ID } from 'storybook/internal/types';

import { global } from '@storybook/global';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { MemoryRouter } from 'storybook/internal/router';
import { ManagerContext, internal_fullStatusStore } from 'storybook/manager-api';
import { expect, fn, userEvent, within } from 'storybook/test';

import { ReviewProvider } from '../review/components/ReviewProvider.tsx';
import { reviewServiceForStories as reviewService } from '../review/review-service-story-helpers.ts';
import { IconSymbols } from './IconSymbols.tsx';
import { ShowChangesButton } from './ShowChangesButton.tsx';

type ChangeStatusValue = 'status-value:new' | 'status-value:modified';

const setChangeStatuses = (entries: Record<string, ChangeStatusValue>) => {
  internal_fullStatusStore.set(
    Object.entries(entries).map(([storyId, value]) => ({
      storyId,
      typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
      value,
      title: 'Change Detection',
      description: '',
    }))
  );
  return () => internal_fullStatusStore.unset();
};

const buildIndexEntries = (storyIds: string[], extraTags: Record<string, string[]> = {}) =>
  storyIds.reduce<Record<string, any>>((acc, id) => {
    acc[id] = {
      type: 'story',
      id,
      name: id,
      title: id,
      importPath: `./${id}.stories.tsx`,
      tags: ['dev', ...(extraTags[id] ?? [])],
    };
    return acc;
  }, {});

const makeManagerContext = (
  options: {
    includedStatusFilters?: string[];
    excludedStatusFilters?: string[];
    includedTagFilters?: string[];
    excludedTagFilters?: string[];
    storyIds?: string[];
    extraTags?: Record<string, string[]>;
    setAllStatusFilters?: ReturnType<typeof fn>;
  } = {}
): any => ({
  state: {
    path: '/',
    viewMode: 'story',
    customQueryParams: {},
    includedStatusFilters: options.includedStatusFilters ?? [],
    excludedStatusFilters: options.excludedStatusFilters ?? [],
    includedTagFilters: options.includedTagFilters ?? [],
    excludedTagFilters: options.excludedTagFilters ?? [],
    internal_index: {
      v: 5,
      entries: buildIndexEntries(options.storyIds ?? [], options.extraTags),
    },
    docsOptions: {
      defaultName: 'Docs',
      autodocs: 'tag',
      docsMode: false,
    },
  },
  api: {
    on: fn().mockName('api::on'),
    off: fn().mockName('api::off'),
    once: fn().mockName('api::once'),
    emit: fn().mockName('api::emit'),
    navigate: fn().mockName('api::navigate'),
    setQueryParams: fn().mockName('api::setQueryParams'),
    addNotification: fn().mockName('api::addNotification'),
    clearNotification: fn().mockName('api::clearNotification'),
    getUrlState: () => ({ path: '/', queryParams: {} }),
    getStoryHrefs: (storyId: string) => ({
      managerHref: `?path=/story/${storyId}`,
      previewHref: `iframe.html?id=${storyId}&viewMode=story`,
    }),
    setAllTagFilters: fn().mockName('api::setAllTagFilters'),
    setAllStatusFilters: options.setAllStatusFilters ?? fn().mockName('api::setAllStatusFilters'),
  },
});

const meta = {
  component: ShowChangesButton,
  title: 'Sidebar/ShowChangesButton',
  decorators: [
    (Story, { parameters }) => {
      const content = (
        <>
          <IconSymbols />
          <div style={{ padding: '8px', width: '280px' }}>
            <Story />
          </div>
        </>
      );
      return (
        <MemoryRouter initialEntries={['/']}>
          <ManagerContext.Provider value={makeManagerContext(parameters?.contextOptions ?? {})}>
            {/* Without a provider, consumers read the context default: no active review. */}
            {parameters?.withReviewProvider ? <ReviewProvider>{content}</ReviewProvider> : content}
          </ManagerContext.Provider>
        </MemoryRouter>
      );
    },
  ],
  beforeEach: async () => {
    await reviewService.commands.dismissReview(undefined);
    sessionStorage.clear();
    const features = global.FEATURES;
    global.FEATURES = { ...features, changeDetection: true };
    return () => {
      global.FEATURES = features;
    };
  },
} satisfies Meta<typeof ShowChangesButton>;

export default meta;

type Story = StoryObj<typeof meta>;

const eightStoryIds = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];

const fiveNewThreeModified = () =>
  setChangeStatuses({
    s1: 'status-value:new',
    s2: 'status-value:new',
    s3: 'status-value:new',
    s4: 'status-value:new',
    s5: 'status-value:new',
    s6: 'status-value:modified',
    s7: 'status-value:modified',
    s8: 'status-value:modified',
  });

const twoStoriesBeforeEach = () =>
  setChangeStatuses({ s1: 'status-value:new', s2: 'status-value:modified' });

/** Feature flag on, 5 new stories, 3 modified. No filters active. */
export const Idle: Story = {
  parameters: {
    contextOptions: {
      storyIds: eightStoryIds,
    },
  },
  beforeEach: fiveNewThreeModified,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('switch');
    await expect(button).toHaveTextContent('Show new and modified stories');
    await expect(button).toHaveAttribute('aria-checked', 'false');
  },
};

/** Both new and modified filters active, so the CTA reads as on. */
export const Active: Story = {
  parameters: {
    contextOptions: {
      storyIds: eightStoryIds,
      includedStatusFilters: ['status-value:new', 'status-value:modified'],
    },
  },
  beforeEach: fiveNewThreeModified,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('switch');
    await expect(button).toHaveTextContent('Showing new and modified stories');
    await expect(button).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByRole('button', { name: 'Clear' })).toBeVisible();
  },
};

/** Only 'status-value:new' is filtered on, which is not the full toggle state. */
export const PartialFilter: Story = {
  parameters: {
    contextOptions: {
      storyIds: eightStoryIds,
      includedStatusFilters: ['status-value:new'],
    },
  },
  beforeEach: fiveNewThreeModified,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('switch');
    await expect(button).toHaveAttribute('aria-checked', 'false');
    await expect(button.textContent).toMatch(/^Show /);
  },
};

/** Only new stories present (no modified). Label should omit the "modified" segment. */
export const OnlyNew: Story = {
  parameters: {
    contextOptions: {
      storyIds: ['s1', 's2'],
    },
  },
  beforeEach: () => setChangeStatuses({ s1: 'status-value:new', s2: 'status-value:new' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('switch');
    await expect(button).toHaveTextContent('Show new stories');
    await expect(button.textContent).not.toMatch(/modified/);
  },
};

/** Only modified stories present (no new). Label should omit the "new" segment. */
export const OnlyModified: Story = {
  parameters: {
    contextOptions: {
      storyIds: ['s1', 's2', 's3'],
    },
  },
  beforeEach: () =>
    setChangeStatuses({
      s1: 'status-value:modified',
      s2: 'status-value:modified',
      s3: 'status-value:modified',
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('switch');
    await expect(button).toHaveTextContent('Show modified stories');
    await expect(button.textContent).not.toMatch(/\bnew\b/);
  },
};

/**
 * Contextual filtering: a tag filter narrows the eligible scope, so the CTA only surfaces
 * categories whose stories pass the active tag filter.
 *
 * Setup: 5 new stories, 3 modified. Two of the new stories carry the `feature-a` tag, none of the
 * modified ones do. With include filter `feature-a`, the modified category drops out and the CTA
 * reads "Show new stories" (not the combined label).
 */
export const ContextualTagFilter: Story = {
  parameters: {
    contextOptions: {
      storyIds: eightStoryIds,
      includedTagFilters: ['feature-a'],
      extraTags: { s1: ['feature-a'], s2: ['feature-a'] },
    },
  },
  beforeEach: fiveNewThreeModified,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('switch');
    await expect(button).toHaveTextContent('Show new stories');
    await expect(button.textContent).not.toMatch(/modified/);
  },
};

/** The review widget renders in the same spot and takes precedence over this CTA. */
export const HiddenWhenReviewActive: Story = {
  parameters: {
    withReviewProvider: true,
    contextOptions: {
      storyIds: ['s1', 's2'],
    },
  },
  beforeEach: async () => {
    await reviewService.commands.setReview({
      title: 'Button style changes',
      description: '',
      createdAt: Date.now(),
      collections: [{ title: 'Collection', rationale: '', storyIds: ['s1', 's2'] }],
    });
    return twoStoriesBeforeEach();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('switch')).toBeNull();
  },
};

/** Feature flag on, but no statuses in the store: nothing to show. */
export const HiddenWhenZeroCounts: Story = {
  beforeEach: () => {
    internal_fullStatusStore.unset();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('switch')).toBeNull();
  },
};

/** Feature flag off: nothing to show. */
export const HiddenWhenFeatureOff: Story = {
  parameters: {
    contextOptions: {
      storyIds: ['s1'],
    },
  },
  beforeEach: () => {
    const cleanup = setChangeStatuses({ s1: 'status-value:new' });
    const features = global.FEATURES;
    global.FEATURES = { ...features, changeDetection: false };
    return () => {
      global.FEATURES = features;
      cleanup();
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('switch')).toBeNull();
  },
};

const toggleActivateMock = fn().mockName('api::setAllStatusFilters');

/** Clicking the CTA includes both change-detection statuses in the sidebar filters. */
export const ToggleActivate: Story = {
  parameters: {
    contextOptions: {
      storyIds: ['s1', 's2'],
      includedStatusFilters: [],
      excludedStatusFilters: [],
      setAllStatusFilters: toggleActivateMock,
    },
  },
  beforeEach: () => {
    toggleActivateMock.mockClear();
    return twoStoriesBeforeEach();
  },
  play: async ({ canvasElement, parameters }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('switch');
    await userEvent.click(button);
    const mock = parameters.contextOptions.setAllStatusFilters;
    await expect(mock).toHaveBeenCalledOnce();
    const [included, excluded] = mock.mock.calls[0];
    await expect(included).toContain('status-value:new');
    await expect(included).toContain('status-value:modified');
    await expect(excluded).toEqual([]);
  },
};

const togglePreservesMock = fn().mockName('api::setAllStatusFilters');

/**
 * Activating the CTA moves a previously excluded change-detection status to included, rather than
 * leaving the story hidden by its own exclusion.
 */
export const TogglePreservesExcluded: Story = {
  parameters: {
    contextOptions: {
      storyIds: ['s1', 's2'],
      includedStatusFilters: [],
      excludedStatusFilters: ['status-value:new'],
      setAllStatusFilters: togglePreservesMock,
    },
  },
  beforeEach: () => {
    togglePreservesMock.mockClear();
    return twoStoriesBeforeEach();
  },
  play: async ({ canvasElement, parameters }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('switch');
    await userEvent.click(button);
    const mock = parameters.contextOptions.setAllStatusFilters;
    await expect(mock).toHaveBeenCalledOnce();
    const [included, excluded] = mock.mock.calls[0];
    await expect(included).toContain('status-value:new');
    await expect(included).toContain('status-value:modified');
    await expect(excluded).not.toContain('status-value:new');
  },
};

const clearMock = fn().mockName('api::setAllStatusFilters');

/** The clear button next to an active CTA drops both change-detection filters. */
export const ClearWhileActive: Story = {
  parameters: {
    contextOptions: {
      storyIds: ['s1', 's2'],
      includedStatusFilters: ['status-value:new', 'status-value:modified'],
      setAllStatusFilters: clearMock,
    },
  },
  beforeEach: () => {
    clearMock.mockClear();
    return twoStoriesBeforeEach();
  },
  play: async ({ canvasElement, parameters }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Clear' }));
    const mock = parameters.contextOptions.setAllStatusFilters;
    await expect(mock).toHaveBeenCalledWith([], []);
  },
};
