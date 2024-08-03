import React from 'react';
import { within, userEvent, expect, fn } from '@storybook/test';
import type { StoryObj, Meta } from '@storybook/react';
import { ManagerContext } from '@storybook/core/manager-api';

import { index } from './mockdata.large';
import { Search } from './Search';
import { SearchResults } from './SearchResults';
import { noResults } from './SearchResults.stories';
import { DEFAULT_REF_ID } from './Sidebar';
import type { Selection } from './types';
import { IconSymbols } from './IconSymbols';
import { LayoutProvider } from '../layout/LayoutProvider';

const refId = DEFAULT_REF_ID;
const data = { [refId]: { id: refId, url: '/', index, previewInitialized: true } };
const dataset = { hash: data, entries: Object.entries(data) };
const getLastViewed = () =>
  Object.values(index)
    .filter((item, i) => item.type === 'component' && item.parent && i % 20 === 0)
    .map((component) => ({ storyId: component.id, refId }));

const setQueryParams = fn().mockName('setQueryParams');
const getQueryParams = fn().mockName('setQueryParams');

const meta = {
  component: Search,
  title: 'Sidebar/Search',
  parameters: { layout: 'fullscreen' },
  args: {
    dataset,
    getLastViewed: (): Selection[] => [],
    children: () => <SearchResults {...noResults} />,
  },
  render: ({ children, ...args }) => {
    return <Search {...args}>{children}</Search>;
  },
  globals: { sb_theme: 'side-by-side' },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider
        value={
          {
            state: {},
            api: {
              emit: () => {},
              on: () => {},
              off: () => {},
              getShortcutKeys: () => ({ search: ['control', 'shift', 's'] }),
              selectStory: () => {},
              setQueryParams,
              getQueryParams,
            },
          } as any
        }
      >
        <LayoutProvider>
          <IconSymbols />
          {storyFn()}
        </LayoutProvider>
      </ManagerContext.Provider>
    ),
  ],
} satisfies Meta<typeof Search>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Simple: Story = {};

export const SimpleWithCreateButton: Story = {
  args: {
    showCreateStoryButton: true,
  },
};

export const FilledIn: Story = {
  args: {
    initialQuery: 'Search query',
  },
};

export const LastViewed: Story = {
  args: {
    getLastViewed,
  },
};

export const ShortcutsDisabled: Story = {
  args: {
    enableShortcuts: false,
  },
};

export const Searching: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await within(canvasElement);
    const search = await canvas.findByPlaceholderText('Find components');
    await userEvent.clear(search);
    await userEvent.type(search, 'foo');
    expect(setQueryParams).toHaveBeenCalledWith({
      search: 'foo',
    });
  },
};

export const Clearing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await within(canvasElement);
    const search = await canvas.findByPlaceholderText('Find components');
    await userEvent.clear(search);
    await userEvent.type(search, 'foo');

    const clearIcon = await canvas.findByTitle('Clear search');
    await userEvent.click(clearIcon);

    expect(setQueryParams).toHaveBeenCalledWith({ search: null });
  },
};
