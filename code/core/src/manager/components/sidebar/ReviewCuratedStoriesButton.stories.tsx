import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { REVIEW_STATUS_TYPE_ID } from 'storybook/internal/types';

import { ManagerContext, internal_fullStatusStore } from 'storybook/manager-api';
import { expect, fn, userEvent, within } from 'storybook/test';

import { IconSymbols } from './IconSymbols.tsx';
import ReviewCuratedStoriesButton from './ReviewCuratedStoriesButton.tsx';

const setReviewingStatuses = (storyIds: string[]) => {
  internal_fullStatusStore.set(
    storyIds.map((storyId) => ({
      storyId,
      typeId: REVIEW_STATUS_TYPE_ID,
      value: 'status-value:reviewing',
      title: 'Review',
      description: '',
    }))
  );
  return () => internal_fullStatusStore.unset();
};

const buildIndexEntries = (storyIds: string[]) =>
  storyIds.reduce<Record<string, any>>((acc, id) => {
    acc[id] = {
      type: 'story',
      id,
      name: id,
      title: id,
      importPath: `./${id}.stories.tsx`,
      tags: ['dev'],
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
    setAllStatusFilters?: ReturnType<typeof fn>;
    setAllTagFilters?: ReturnType<typeof fn>;
    navigate?: ReturnType<typeof fn>;
    toggleNav?: ReturnType<typeof fn>;
  } = {}
): any => ({
  state: {
    includedStatusFilters: options.includedStatusFilters ?? [],
    excludedStatusFilters: options.excludedStatusFilters ?? [],
    includedTagFilters: options.includedTagFilters ?? [],
    excludedTagFilters: options.excludedTagFilters ?? [],
    internal_index: {
      v: 5,
      entries: buildIndexEntries(options.storyIds ?? []),
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
    setAllStatusFilters: options.setAllStatusFilters ?? fn().mockName('api::setAllStatusFilters'),
    setAllTagFilters: options.setAllTagFilters ?? fn().mockName('api::setAllTagFilters'),
    navigate: options.navigate ?? fn().mockName('api::navigate'),
    toggleNav: options.toggleNav ?? fn().mockName('api::toggleNav'),
  },
});

const meta = {
  component: ReviewCuratedStoriesButton,
  title: 'Sidebar/ReviewCuratedStoriesButton',
  decorators: [
    (Story, { parameters }) => (
      <ManagerContext.Provider value={makeManagerContext(parameters?.contextOptions ?? {})}>
        <IconSymbols />
        <div style={{ padding: '8px', width: '280px' }}>
          <Story />
        </div>
      </ManagerContext.Provider>
    ),
  ],
} satisfies Meta<typeof ReviewCuratedStoriesButton>;

export default meta;

type Story = StoryObj<typeof meta>;

const storyIds = ['s1', 's2', 's3'];

export const Idle: Story = {
  parameters: {
    contextOptions: {
      storyIds,
    },
  },
  beforeEach: () => setReviewingStatuses(storyIds),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('switch');

    await expect(button).toHaveTextContent('Review AI-curated stories');
    await expect(button).toHaveAttribute('aria-checked', 'false');
  },
};

export const Active: Story = {
  parameters: {
    contextOptions: {
      storyIds,
      includedStatusFilters: ['status-value:reviewing'],
    },
  },
  beforeEach: () => setReviewingStatuses(storyIds),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('switch');

    await expect(button).toHaveTextContent('Reviewing AI-curated stories');
    await expect(button).toHaveAttribute('aria-checked', 'true');
  },
};

export const HiddenWhenZeroCounts: Story = {
  beforeEach: () => {
    internal_fullStatusStore.unset();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('switch')).toBeNull();
  },
};

const activateMocks = {
  setAllStatusFilters: fn().mockName('api::setAllStatusFilters'),
  setAllTagFilters: fn().mockName('api::setAllTagFilters'),
  navigate: fn().mockName('api::navigate'),
  toggleNav: fn().mockName('api::toggleNav'),
};

export const ToggleActivate: Story = {
  parameters: {
    contextOptions: {
      storyIds: ['s1', 's2'],
      includedTagFilters: ['feature-a'],
      includedStatusFilters: ['status-value:new'],
      excludedStatusFilters: ['status-value:modified'],
      setAllStatusFilters: activateMocks.setAllStatusFilters,
      setAllTagFilters: activateMocks.setAllTagFilters,
      navigate: activateMocks.navigate,
      toggleNav: activateMocks.toggleNav,
    },
  },
  beforeEach: () => {
    activateMocks.setAllStatusFilters.mockClear();
    activateMocks.setAllTagFilters.mockClear();
    activateMocks.navigate.mockClear();
    activateMocks.toggleNav.mockClear();
    return setReviewingStatuses(['s1', 's2']);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('switch');
    await userEvent.click(button);

    await expect(activateMocks.setAllTagFilters).toHaveBeenCalledWith([], []);
    await expect(activateMocks.setAllStatusFilters).toHaveBeenCalledWith(
      ['status-value:reviewing'],
      []
    );
    await expect(activateMocks.toggleNav).toHaveBeenCalledWith(false);
    await expect(activateMocks.navigate).toHaveBeenCalledWith('/review/');
  },
};

const restoreMocks = {
  setAllStatusFilters: fn().mockName('api::setAllStatusFilters'),
  setAllTagFilters: fn().mockName('api::setAllTagFilters'),
};

export const ClearWhenAlreadyFiltered: Story = {
  parameters: {
    contextOptions: {
      storyIds: ['s1'],
      includedStatusFilters: ['status-value:reviewing'],
      setAllStatusFilters: restoreMocks.setAllStatusFilters,
      setAllTagFilters: restoreMocks.setAllTagFilters,
    },
  },
  beforeEach: () => {
    restoreMocks.setAllStatusFilters.mockClear();
    restoreMocks.setAllTagFilters.mockClear();
    return setReviewingStatuses(['s1']);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('switch');
    await userEvent.click(button);

    await expect(restoreMocks.setAllTagFilters).toHaveBeenCalledWith([], []);
    await expect(restoreMocks.setAllStatusFilters).toHaveBeenCalledWith([], []);
  },
};
