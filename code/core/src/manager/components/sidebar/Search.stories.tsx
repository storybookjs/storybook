import React, { useState } from 'react';

import type { StoryIndex } from 'storybook/internal/types';

import type { Meta, StoryFn, StoryObj } from '@storybook/react-vite';

import type { API, State } from 'storybook/manager-api';
import { ManagerContext, useStorybookState } from 'storybook/manager-api';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { transformStoryIndexToStoriesHash } from '../../../manager-api/lib/stories.ts';
import type { ModuleArgs } from '../../../manager-api/lib/types.tsx';
import { init as initStories } from '../../../manager-api/modules/stories.ts';
import Store from '../../../manager-api/store.ts';
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

export const ComponentWithSubcomponents: StoryObj<Meta<typeof Search>> = {
  globals: { sb_theme: 'light' },
  decorators: [
    (Story) => {
      const [selectedPage, setSelectedPage] = useState('No page selected');
      const [context] = useState(() => {
        const provider = { getConfig: () => ({}) } as ModuleArgs['provider'];
        const entries: StoryIndex['entries'] = {
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
        const index = transformStoryIndexToStoriesHash(
          { v: 5, entries },
          { provider, docsOptions: {}, filters: {}, allStatuses: {} }
        );
        let state = { index, filteredIndex: index, filters: {} } as State;
        const store = new Store({
          allowPersistence: false,
          getState: () => state,
          setState: (patch, callback) => {
            state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
            callback?.();
          },
        });
        const fullAPI = { getRefs: () => ({}) } as API;
        const { api } = initStories({
          store,
          provider,
          navigate: setSelectedPage,
          fullAPI,
          state,
        } as ModuleArgs);

        return {
          api: Object.assign(fullAPI, api, { emit: fn(), getShortcutKeys: () => defaultShortcuts }),
          state,
        };
      });

      return (
        <ManagerContext.Provider value={context}>
          <Story />
          <output aria-label="Selected page">{selectedPage}</output>
        </ManagerContext.Provider>
      );
    },
  ],
  render: () => {
    const { index } = useStorybookState();
    const ref = {
      id: refId,
      url: '/',
      index,
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
    await userEvent.click(canvasElement.querySelector('[data-id="components-button"]')!);
    await waitFor(() =>
      expect(canvas.getByLabelText('Selected page')).toHaveTextContent(
        '/docs/components-button--docs'
      )
    );

    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, 'Icon');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await waitFor(() =>
      expect(canvas.getByLabelText('Selected page')).toHaveTextContent(
        '/story/components-button-icon--primary'
      )
    );

    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, 'Button');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await waitFor(() =>
      expect(canvas.getByLabelText('Selected page')).toHaveTextContent(
        '/docs/components-button--docs'
      )
    );
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
