import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, themes, convert } from '@storybook/theming';
import * as api from '@storybook/manager-api';

import { FILTER_KEY } from '../Search';
import * as Stories from '../Search.stories';
import * as SidebarStories from '../Sidebar.stories';

const TEST_URL = 'http://localhost';
const FILTER_VALUE = 'filter';
const PLACEHOLDER = 'Find components';
const DEFAULT_SEARCH = '?path=story';

const setLocation = (search = DEFAULT_SEARCH) => {
  global.window.history.replaceState({}, 'Test', search);
};

const renderSearch = (Story = Stories.Simple) =>
  render(
    <ThemeProvider theme={convert(themes.light)}>
      <Story />
    </ThemeProvider>
  );

jest.mock('@storybook/manager-api');
const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  const { history, location } = global.window;
  delete global.window.location;
  delete global.window.history;
  global.window.location = { ...location };
  global.window.history = { ...history };

  global.window.history.replaceState = (state, title, url: string) => {
    global.window.location.href = url;
    global.window.location.search = url.indexOf('?') !== -1 ? url.slice(url.indexOf('?')) : '';
  };
  mockedApi.useStorybookApi.mockReset();
  const mockApi: Partial<api.API> = {
    setQueryParams: () => ({}),
  };
  mockedApi.useStorybookApi.mockReturnValue(mockApi as any);
  mockedApi.useStorybookState.mockReset();
});

describe('Search - reflect search in URL', () => {
  it('renders OK', async () => {
    setLocation();
    renderSearch();
    const INPUT = (await screen.getByPlaceholderText(PLACEHOLDER)) as HTMLInputElement;
    expect(INPUT.value).toBe('');
  });
  // it('prefills input with search params', async () => {
  //   const state: Partial<api.State> = {
  //     storyId: 'jest',
  //     customQueryParams: {
  //       filter: 'filter',
  //     },
  //     ui: { enableShortcuts: true },
  //   };
  //   mockedApi.useStorybookState.mockReturnValue(state as any);
  //   setLocation('?path=story&filter=filter');
  //   renderSearch(SidebarStories.Simple);
  //   const INPUT = (await screen.getByPlaceholderText(PLACEHOLDER)) as HTMLInputElement;
  //   expect(INPUT.value).toBe(FILTER_VALUE);
  // });
  it('updates location on input update with current query', async () => {
    setLocation();
    renderSearch();
    const INPUT = await screen.getByPlaceholderText(PLACEHOLDER);
    userEvent.clear(INPUT);
    // Using "paste" due to bug with @testing-library/user-event || jest: https://github.com/testing-library/user-event/issues/369
    userEvent.paste(INPUT, FILTER_VALUE);
    expect(global.window.location.href).toBe(
      `${TEST_URL}${DEFAULT_SEARCH}&${FILTER_KEY}=${FILTER_VALUE}`
    );
    expect(global.window.location.search).toBe(`${DEFAULT_SEARCH}&${FILTER_KEY}=${FILTER_VALUE}`);
  });
  it('updates location on input update without current query', async () => {
    setLocation();
    renderSearch();
    const INPUT = await screen.getByPlaceholderText(PLACEHOLDER);
    userEvent.clear(INPUT);
    userEvent.paste(INPUT, FILTER_VALUE);
    expect(global.window.location.href).toBe(
      `${TEST_URL}${DEFAULT_SEARCH}&${FILTER_KEY}=${FILTER_VALUE}`
    );
    expect(global.window.location.search).toBe(`${DEFAULT_SEARCH}&${FILTER_KEY}=${FILTER_VALUE}`);
  });
  it('initialQuery updates URL', async () => {
    const SEARCH_TERM = 'Search query';
    const QUERY_VALUE = 'Search+query';
    setLocation();
    renderSearch(Stories.FilledIn);
    const INPUT = (await screen.getByPlaceholderText(PLACEHOLDER)) as HTMLInputElement;
    expect(INPUT.value).toBe(SEARCH_TERM);
    expect(global.window.location.href).toBe(
      `${TEST_URL}${DEFAULT_SEARCH}&${FILTER_KEY}=${QUERY_VALUE}`
    );
    expect(global.window.location.search).toBe(`${DEFAULT_SEARCH}&${FILTER_KEY}=${QUERY_VALUE}`);
  });
});
