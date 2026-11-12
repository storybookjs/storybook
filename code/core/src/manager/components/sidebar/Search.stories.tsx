import React from 'react';

import type { API_Provider, StoryIndex } from 'storybook/internal/types';

import type { Meta, StoryFn, StoryObj } from '@storybook/react-vite';

import type { API, State } from 'storybook/manager-api';
import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { transformStoryIndexToStoriesHash } from '../../../manager-api/lib/stories.ts';
import { defaultShortcuts } from '../../settings/defaultShortcuts.tsx';
import { IconSymbols } from './IconSymbols.tsx';
import { Search } from './Search.tsx';
import type { SearchProps } from './Search.tsx';
import { SearchResults } from './SearchResults.tsx';
import { noResults } from './SearchResults.stories.tsx';
import { DEFAULT_REF_ID } from './Sidebar.tsx';
import { index } from './mockdata.large.ts';
import type { Selection } from './types.ts';

const refId = DEFAULT_REF_ID;
const data = { [refId]: { id: refId, url: '/', index, previewInitialized: true, allStatuses: {} } };
const dataset = { hash: data, entries: Object.entries(data) };
const getLastViewed = () =>
  Object.values(index)
    .filter((item, i) => item.type === 'component' && item.parent && i % 20 === 0)
    .map((component) => ({ storyId: component.id, refId }));

const meta = {
  component: Search,
  title: 'Sidebar/Search',
  parameters: { layout: 'fullscreen' },
  globals: { sb_theme: 'side-by-side' },
  decorators: [
    (storyFn: any) => (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: 20,
          maxWidth: '230px',
        }}
      >
        <IconSymbols />
        {storyFn()}
      </div>
    ),
  ],
} satisfies Meta<typeof Search>;
export default meta;

const baseProps: Omit<SearchProps, 'children'> = {
  dataset,
  getLastViewed: () => [] as Selection[],
};

export const Simple: StoryFn = () => <Search {...baseProps}>{() => null}</Search>;

export const FilledIn: StoryFn = () => (
  <Search {...baseProps} initialQuery="Foo bar">
    {() => <SearchResults {...noResults} />}
  </Search>
);

const nestedEntries: StoryIndex['entries'] = {
  'custom-guide--docs': {
    type: 'docs',
    id: 'custom-guide--docs',
    title: 'Components/Button/Guide',
    name: 'Docs',
    importPath: './guide.mdx',
    storiesImports: [],
  },
  'components-button-icon--primary': {
    type: 'story',
    subtype: 'story',
    id: 'components-button-icon--primary',
    title: 'Components/Button/Icon',
    name: 'Primary',
    importPath: './icon.stories.ts',
  },
  'components-button--docs': {
    type: 'docs',
    id: 'components-button--docs',
    title: 'Components/Button',
    name: 'Docs',
    importPath: './button.stories.ts',
    storiesImports: [],
  },
  'components-button--primary': {
    type: 'story',
    subtype: 'story',
    id: 'components-button--primary',
    title: 'Components/Button',
    name: 'Primary',
    importPath: './button.stories.ts',
  },
};
const provider = { getConfig: () => ({}) } as API_Provider<API>;
const nestedIndex = transformStoryIndexToStoriesHash(
  { v: 5, entries: nestedEntries },
  { provider, docsOptions: {}, filters: {}, allStatuses: {} }
);
const selectNestedStory = fn().mockName('api::selectStory');
const nestedApi: Partial<API> = {
  selectStory: selectNestedStory,
  resolveStory: (id) => nestedIndex[id],
  emit: fn(),
  getShortcutKeys: () => defaultShortcuts,
};

export const ComponentWithSubcomponents: StoryObj<Meta<typeof Search>> = {
  // A single canvas keeps keyboard focus and searchbox queries unambiguous.
  globals: { sb_theme: 'light' },
  beforeEach: () => {
    selectNestedStory.mockClear();
  },
  decorators: [
    (Story) => (
      <ManagerContext.Provider
        value={{
          api: nestedApi as API,
          state: { index: nestedIndex } as State,
        }}
      >
        <Story />
      </ManagerContext.Provider>
    ),
  ],
  render: () => {
    const ref = {
      id: refId,
      url: '/',
      index: nestedIndex,
      previewInitialized: true,
      allStatuses: {},
    };

    return (
      <Search
        dataset={{ hash: { [refId]: ref }, entries: [[refId, ref]] }}
        getLastViewed={() => []}
        initialQuery="Button"
      >
        {({ query, results, closeMenu, getMenuProps, getItemProps, highlightedIndex }) => (
          <SearchResults
            query={query}
            results={results}
            closeMenu={closeMenu}
            getMenuProps={getMenuProps}
            getItemProps={getItemProps}
            highlightedIndex={highlightedIndex}
          />
        )}
      </Search>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('searchbox');
    await userEvent.click(input);
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-id="components-button"]')).toBeInTheDocument()
    );
    await userEvent.click(canvasElement.querySelector('[data-id="components-button"]')!);
    await expect(selectNestedStory).toHaveBeenLastCalledWith('components-button', undefined, {
      ref: false,
      scrollTo: undefined,
    });

    selectNestedStory.mockClear();
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, 'Icon');
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() =>
      expect(canvas.getByRole('option', { selected: true })).toHaveAttribute(
        'data-id',
        'components-button-icon'
      )
    );
    await userEvent.keyboard('{Enter}');
    await expect(selectNestedStory).toHaveBeenLastCalledWith('components-button-icon', undefined, {
      ref: false,
      scrollTo: undefined,
    });

    selectNestedStory.mockClear();
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, 'Button');
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() =>
      expect(canvas.getByRole('option', { selected: true })).toHaveAttribute(
        'data-id',
        'components-button'
      )
    );
    await userEvent.keyboard('{Enter}');
    await expect(selectNestedStory).toHaveBeenLastCalledWith('components-button', undefined, {
      ref: false,
      scrollTo: undefined,
    });
  },
};

export const LastViewed: StoryFn = () => (
  <Search {...baseProps} getLastViewed={getLastViewed}>
    {({ query, results, closeMenu, getMenuProps, getItemProps, highlightedIndex }) => (
      <SearchResults
        query={query}
        results={results}
        closeMenu={closeMenu}
        getMenuProps={getMenuProps}
        getItemProps={getItemProps}
        highlightedIndex={highlightedIndex}
      />
    )}
  </Search>
);

const escapeAbove = fn().mockName('escapeAbove');

/**
 * Escape never leaves the field: with a query it clears the query, with an empty field it hands
 * focus to the explorer. Only an Escape from the explorer reaches the ancestors, where the mobile
 * menu drawer closes on it. Without this ladder the drawer closed on the first press, or kept the
 * focus trapped in the empty field (the drawer's focus scope returns it there after a blur).
 */
export const EscapeWithQueryStaysInSearch: StoryFn = () => (
  <div
    onKeyDown={(event) => {
      if (event.key === 'Escape') {
        escapeAbove();
      }
    }}
  >
    <Search {...baseProps} initialQuery="Foo">
      {() => null}
    </Search>
  </div>
);
EscapeWithQueryStaysInSearch.play = async ({ canvasElement }) => {
  escapeAbove.mockClear();
  const input = within(canvasElement).getByRole('searchbox');
  await userEvent.click(input);
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(input).toHaveValue(''));
  expect(escapeAbove).not.toHaveBeenCalled();

  const explorer = canvasElement.querySelector('#storybook-explorer-menu');
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(explorer).toHaveFocus());
  expect(escapeAbove).not.toHaveBeenCalled();

  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(escapeAbove).toHaveBeenCalledOnce());
};

export const ShortcutsDisabled: StoryFn = () => (
  <Search {...baseProps} enableShortcuts={false}>
    {() => null}
  </Search>
);

export const CustomShortcuts: StoryFn = () => <Search {...baseProps}>{() => null}</Search>;

CustomShortcuts.decorators = [
  (storyFn) => (
    <ManagerContext.Provider
      value={
        {
          api: {
            getShortcutKeys: () => ({ search: ['control', 'shift', 's'] }),
          } as API,
        } as any
      }
    >
      {storyFn()}
    </ManagerContext.Provider>
  ),
];
