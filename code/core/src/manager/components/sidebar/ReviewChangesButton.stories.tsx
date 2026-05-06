import React from 'react';

import { global } from '@storybook/global';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, userEvent, within } from 'storybook/test';

import { internal_fullStatusStore } from 'storybook/manager-api';

import { IconSymbols } from './IconSymbols.tsx';
import ReviewChangesButton from './ReviewChangesButton.tsx';

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
    setAllStatusFilters: options.setAllStatusFilters ?? fn().mockName('api::setAllStatusFilters'),
  },
});

const meta = {
  component: ReviewChangesButton,
  title: 'Sidebar/ReviewChangesButton',
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
  beforeEach: () => {
    const features = global.FEATURES;
    global.FEATURES = { ...features, changeDetection: true };
    return () => {
      global.FEATURES = features;
    };
  },
} satisfies Meta<typeof ReviewChangesButton>;

export default meta;

type Story = StoryObj<typeof meta>;

const twoStoriesBeforeEach = () => {
  internal_fullStatusStore.set([
    {
      storyId: 's1',
      typeId: 'storybook/change-detection',
      value: 'status-value:new',
      title: 'Change Detection',
      description: '',
    },
    {
      storyId: 's2',
      typeId: 'storybook/change-detection',
      value: 'status-value:modified',
      title: 'Change Detection',
      description: '',
    },
  ]);
  return () => internal_fullStatusStore.unset();
};

const eightStoryIds = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];

/**
 * Feature flag on, 5 new stories, 3 modified. No filters active.
 * Shows "Review new and modified stories".
 */
export const Idle: Story = {
  parameters: {
    contextOptions: {
      storyIds: eightStoryIds,
    },
  },
  beforeEach: () => {
    internal_fullStatusStore.set([
      {
        storyId: 's1',
        typeId: 'storybook/change-detection',
        value: 'status-value:new',
        title: 'Change Detection',
        description: '',
      },
      {
        storyId: 's2',
        typeId: 'storybook/change-detection',
        value: 'status-value:new',
        title: 'Change Detection',
        description: '',
      },
      {
        storyId: 's3',
        typeId: 'storybook/change-detection',
        value: 'status-value:new',
        title: 'Change Detection',
        description: '',
      },
      {
        storyId: 's4',
        typeId: 'storybook/change-detection',
        value: 'status-value:new',
        title: 'Change Detection',
        description: '',
      },
      {
        storyId: 's5',
        typeId: 'storybook/change-detection',
        value: 'status-value:new',
        title: 'Change Detection',
        description: '',
      },
      {
        storyId: 's6',
        typeId: 'storybook/change-detection',
        value: 'status-value:modified',
        title: 'Change Detection',
        description: '',
      },
      {
        storyId: 's7',
        typeId: 'storybook/change-detection',
        value: 'status-value:modified',
        title: 'Change Detection',
        description: '',
      },
      {
        storyId: 's8',
        typeId: 'storybook/change-detection',
        value: 'status-value:modified',
        title: 'Change Detection',
        description: '',
      },
    ]);
    return () => internal_fullStatusStore.unset();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await expect(button).toHaveTextContent('Review new and modified stories');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  },
};

/**
 * Both new and modified filters active.
 * Shows "Reviewing new and modified stories" with aria-pressed="true".
 */
export const Active: Story = {
  parameters: {
    contextOptions: {
      storyIds: eightStoryIds,
      includedStatusFilters: ['status-value:new', 'status-value:modified'],
    },
  },
  beforeEach: Idle.beforeEach,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await expect(button).toHaveTextContent('Reviewing new and modified stories');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  },
};

/**
 * Only 'status-value:new' in includedStatusFilters — not fully active.
 * Shows "Review …" (not "Reviewing") and aria-pressed="false".
 */
export const PartialFilter: Story = {
  parameters: {
    contextOptions: {
      storyIds: eightStoryIds,
      includedStatusFilters: ['status-value:new'],
    },
  },
  beforeEach: Idle.beforeEach,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(button.textContent).toMatch(/^Review /);
  },
};

/**
 * Only new stories present (no modified). Label should omit the "modified" segment.
 */
export const OnlyNew: Story = {
  parameters: {
    contextOptions: {
      storyIds: ['s1', 's2'],
    },
  },
  beforeEach: () => {
    internal_fullStatusStore.set([
      {
        storyId: 's1',
        typeId: 'storybook/change-detection',
        value: 'status-value:new',
        title: 'Change Detection',
        description: '',
      },
      {
        storyId: 's2',
        typeId: 'storybook/change-detection',
        value: 'status-value:new',
        title: 'Change Detection',
        description: '',
      },
    ]);
    return () => internal_fullStatusStore.unset();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await expect(button).toHaveTextContent('Review new stories');
    await expect(button.textContent).not.toMatch(/modified/);
  },
};

/**
 * Only modified stories present (no new). Label should omit the "new" segment.
 */
export const OnlyModified: Story = {
  parameters: {
    contextOptions: {
      storyIds: ['s1', 's2', 's3'],
    },
  },
  beforeEach: () => {
    internal_fullStatusStore.set([
      {
        storyId: 's1',
        typeId: 'storybook/change-detection',
        value: 'status-value:modified',
        title: 'Change Detection',
        description: '',
      },
      {
        storyId: 's2',
        typeId: 'storybook/change-detection',
        value: 'status-value:modified',
        title: 'Change Detection',
        description: '',
      },
      {
        storyId: 's3',
        typeId: 'storybook/change-detection',
        value: 'status-value:modified',
        title: 'Change Detection',
        description: '',
      },
    ]);
    return () => internal_fullStatusStore.unset();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await expect(button).toHaveTextContent('Review modified stories');
    await expect(button.textContent).not.toMatch(/\bnew\b/);
  },
};

/**
 * Contextual filtering: a tag filter narrows the eligible scope, so the CTA only
 * surfaces categories whose stories pass the active tag filter.
 *
 * Setup: 5 new stories, 3 modified. Two of the new stories carry the `feature-a` tag,
 * none of the modified ones do. With include filter `feature-a`, the modified
 * category drops out and the CTA reads "Review new stories" (not the combined label).
 */
export const ContextualTagFilter: Story = {
  parameters: {
    contextOptions: {
      storyIds: eightStoryIds,
      includedTagFilters: ['feature-a'],
      extraTags: { s1: ['feature-a'], s2: ['feature-a'] },
    },
  },
  beforeEach: Idle.beforeEach,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await expect(button).toHaveTextContent('Review new stories');
    await expect(button.textContent).not.toMatch(/modified/);
  },
};

/**
 * Feature flag on, but no statuses in the store.
 * Component should return null — no button rendered.
 */
export const HiddenWhenZeroCounts: Story = {
  beforeEach: () => {
    internal_fullStatusStore.unset();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};

/**
 * Feature flag off.
 * Component should return null — no button rendered.
 */
export const HiddenWhenFeatureOff: Story = {
  parameters: {
    contextOptions: {
      storyIds: ['s1'],
    },
  },
  beforeEach: () => {
    internal_fullStatusStore.set([
      {
        storyId: 's1',
        typeId: 'storybook/change-detection',
        value: 'status-value:new',
        title: 'Change Detection',
        description: '',
      },
    ]);
    const features = global.FEATURES;
    global.FEATURES = { ...features, changeDetection: false };
    return () => {
      global.FEATURES = features;
      internal_fullStatusStore.unset();
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};

const toggleActivateMock = fn().mockName('api::setAllStatusFilters');

/**
 * Interaction: clicking button with no active filters calls setAllStatusFilters
 * with both new and modified included, and empty excluded.
 */
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
    const button = await canvas.findByRole('button');
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
 * Interaction: clicking button with 'status-value:new' already excluded.
 * After toggle-activate, excluded should NOT contain 'status-value:new'.
 * This is the critical regression guard for the toggle-preservation contract.
 */
export const TogglePreservesExcluded: Story = {
  parameters: {
    contextOptions: {
      storyIds: ['s1', 's2'],
      includedStatusFilters: [],
      // seed 'status-value:new' in excluded to verify it gets removed on activate
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
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    const mock = parameters.contextOptions.setAllStatusFilters;
    await expect(mock).toHaveBeenCalledOnce();
    const [included, excluded] = mock.mock.calls[0];
    // both should be included after activating
    await expect(included).toContain('status-value:new');
    await expect(included).toContain('status-value:modified');
    // 'status-value:new' should have been removed from excluded on toggle-activate
    await expect(excluded).not.toContain('status-value:new');
  },
};
