import React from 'react';

import { global } from '@storybook/global';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, userEvent, within } from 'storybook/test';

import { internal_fullStatusStore } from 'storybook/manager-api';

import { IconSymbols } from './IconSymbols.tsx';
import ReviewChangesButton from './ReviewChangesButton.tsx';

const makeManagerContext = (
  options: {
    includedStatusFilters?: string[];
    excludedStatusFilters?: string[];
    setAllStatusFilters?: ReturnType<typeof fn>;
  } = {}
): any => ({
  state: {
    includedStatusFilters: options.includedStatusFilters ?? [],
    excludedStatusFilters: options.excludedStatusFilters ?? [],
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

/**
 * Feature flag on, 5 new stories, 3 modified. No filters active.
 * Shows "Review 5 new, 3 changed".
 */
export const Idle: Story = {
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
    await expect(button).toHaveTextContent('Review 5 new, 3 changed');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  },
};

/**
 * Both new and modified filters active.
 * Shows "Reviewing 5 new, 3 changed" with aria-pressed="true".
 */
export const Active: Story = {
  parameters: {
    contextOptions: {
      includedStatusFilters: ['status-value:new', 'status-value:modified'],
    },
  },
  beforeEach: Idle.beforeEach,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await expect(button).toHaveTextContent('Reviewing 5 new, 3 changed');
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
