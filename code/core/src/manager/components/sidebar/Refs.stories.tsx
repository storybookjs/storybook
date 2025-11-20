/* eslint-disable local-rules/no-uncategorized-errors */
import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { fn, userEvent, within } from 'storybook/test';
import { dedent } from 'ts-dedent';

import { standardData as standardHeaderData } from './Heading.stories';
import { IconSymbols } from './IconSymbols';
import { Ref } from './Refs';
import { mockDataset } from './mockdata';
import type { RefType } from './types';

const managerContext = {
  state: { docsOptions: {} },
  api: {
    on: fn().mockName('api::on'),
    off: fn().mockName('api::off'),
    once: fn().mockName('api::once'),
    emit: fn().mockName('api::emit'),
    getElements: fn(() => ({})).mockName('api::getElements'),
    getShortcutKeys: fn(() => ({})).mockName('api::getShortcutKeys'),
  },
} as any;

const meta = {
  component: Ref,
  title: 'Sidebar/Refs',
  excludeStories: /.*Data$/,
  parameters: {
    layout: 'fullscreen',
    chromatic: { ignoreSelectors: ['[role="dialog"] pre'] },
  },
  globals: { sb_theme: 'side-by-side' },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={managerContext}>
        <IconSymbols />
        {storyFn()}
      </ManagerContext.Provider>
    ),
    (storyFn) => <div style={{ padding: '0 20px', maxWidth: '230px' }}>{storyFn()}</div>,
  ],
} satisfies Meta<typeof Ref>;

export default meta;

const { menu } = standardHeaderData;
const filteredIndex = mockDataset.withRoot;
const storyId = '1-12-121';

export const simpleData = { menu, filteredIndex, storyId };
export const loadingData = { menu, filteredIndex: {} };

// @ts-expect-error (non strict)
const indexError: Error = (() => {
  try {
    const err = new Error('There was a severe problem');
    err.stack = dedent`
      at errorStory (/sb-preview/file.js:000:0001)
      at hookified (/sb-preview/file.js:000:0001)
      at defaultDecorateStory (/sb-preview/file.js:000:0001)
      at jsxDecorator (/assets/file.js:000:0001)
      at hookified (/sb-preview/file.js:000:0001)
      at decorateStory (/sb-preview/file.js:000:0001)
    `;
    throw err;
  } catch (e) {
    return e;
  }
})();

const refs: Record<string, RefType> = {
  optimized: {
    id: 'optimized',
    title: 'It is optimized',
    url: 'https://example.com',
    previewInitialized: false,
    type: 'lazy',
    // @ts-expect-error (invalid input)
    filteredIndex,
    allStatuses: {},
  },
  empty: {
    id: 'empty',
    title: 'It is empty because no stories were loaded',
    url: 'https://example.com',
    type: 'lazy',
    filteredIndex: {},
    previewInitialized: false,
    allStatuses: {},
  },
  startInjected_unknown: {
    id: 'startInjected_unknown',
    title: 'It started injected and is unknown',
    url: 'https://example.com',
    type: 'unknown',
    previewInitialized: false,
    // @ts-expect-error (invalid input)
    filteredIndex,
    allStatuses: {},
  },
  startInjected_loading: {
    id: 'startInjected_loading',
    title: 'It started injected and is loading',
    url: 'https://example.com',
    type: 'auto-inject',
    previewInitialized: false,
    // @ts-expect-error (invalid input)
    filteredIndex,
    allStatuses: {},
  },
  startInjected_ready: {
    id: 'startInjected_ready',
    title: 'It started injected and is ready',
    url: 'https://example.com',
    type: 'auto-inject',
    previewInitialized: true,
    // @ts-expect-error (invalid input)
    filteredIndex,
    allStatuses: {},
  },
  versions: {
    id: 'versions',
    title: 'It has versions',
    url: 'https://example.com',
    type: 'lazy',
    // @ts-expect-error (invalid input)
    filteredIndex,
    versions: { '1.0.0': 'https://example.com/v1', '2.0.0': 'https://example.com' },
    previewInitialized: true,
    allStatuses: {},
  },
  versionsMissingCurrent: {
    id: 'versions_missing_current',
    title: 'It has versions',
    url: 'https://example.com',
    type: 'lazy',
    // @ts-expect-error (invalid input)
    filteredIndex,
    versions: { '1.0.0': 'https://example.com/v1', '2.0.0': 'https://example.com/v2' },
    previewInitialized: true,
    allStatuses: {},
  },
  error: {
    id: 'error',
    title: 'This has problems',
    url: 'https://example.com',
    type: 'lazy',
    indexError,
    previewInitialized: true,
    allStatuses: {},
  },
  auth: {
    id: 'Authentication',
    title: 'This requires a login',
    url: 'https://example.com',
    type: 'lazy',
    loginUrl: 'https://example.com',
    previewInitialized: true,
    allStatuses: {},
  },
  long: {
    id: 'long',
    title: 'This storybook has a very very long name for some reason',
    url: 'https://example.com',
    // @ts-expect-error (invalid input)
    filteredIndex,
    type: 'lazy',
    versions: {
      '111.111.888-new': 'https://example.com/new',
      '111.111.888': 'https://example.com',
    },
    previewInitialized: true,
  },
  withSourceCode: {
    id: 'sourceCode',
    title: 'This has source code',
    url: 'https://example.com',
    sourceUrl: 'https://github.com/storybookjs/storybook',
    previewInitialized: false,
    type: 'lazy',
    // @ts-expect-error (invalid input)
    filteredIndex,
    allStatuses: {},
  },
};

export const Optimized = () => (
  <Ref
    {...refs.optimized}
    hasEntries={true}
    isLoading={false}
    isBrowsing
    selectedStoryId=""
    highlightedRef={{ current: null }}
    setHighlighted={() => {}}
  />
);
export const NoEntries = () => (
  <Ref
    {...refs.empty}
    hasEntries={false}
    isLoading={false}
    isBrowsing
    selectedStoryId=""
    highlightedRef={{ current: null }}
    setHighlighted={() => {}}
  />
);
export const IsEmpty = () => (
  <Ref
    {...refs.empty}
    hasEntries={true}
    isLoading={false}
    isBrowsing
    selectedStoryId=""
    highlightedRef={{ current: null }}
    setHighlighted={() => {}}
  />
);
export const StartInjectedUnknown = () => (
  <Ref
    {...refs.startInjected_unknown}
    hasEntries={true}
    isLoading={false}
    isBrowsing
    selectedStoryId=""
    highlightedRef={{ current: null }}
    setHighlighted={() => {}}
  />
);
export const StartInjectedLoading = () => (
  <Ref
    {...refs.startInjected_loading}
    hasEntries={true}
    isLoading={false}
    isBrowsing
    selectedStoryId=""
    highlightedRef={{ current: null }}
    setHighlighted={() => {}}
  />
);
export const StartInjectedReady = () => (
  <Ref
    {...refs.startInjected_ready}
    hasEntries={true}
    isLoading={false}
    isBrowsing
    selectedStoryId=""
    highlightedRef={{ current: null }}
    setHighlighted={() => {}}
  />
);
export const Versions = () => (
  <Ref
    {...refs.versions}
    hasEntries={true}
    isLoading={false}
    isBrowsing
    selectedStoryId=""
    highlightedRef={{ current: null }}
    setHighlighted={() => {}}
  />
);
export const VersionsMissingCurrent = () => (
  <Ref
    {...refs.versionsMissingCurrent}
    hasEntries={true}
    isLoading={false}
    isBrowsing
    selectedStoryId=""
    highlightedRef={{ current: null }}
    setHighlighted={() => {}}
  />
);
export const Errored = () => (
  <Ref
    {...refs.error}
    hasEntries={true}
    isLoading={false}
    isBrowsing
    selectedStoryId=""
    highlightedRef={{ current: null }}
    setHighlighted={() => {}}
  />
);
export const ErroredMobile = () => (
  <Ref
    {...refs.error}
    hasEntries={true}
    isLoading={false}
    isBrowsing
    selectedStoryId=""
    highlightedRef={{ current: null }}
    setHighlighted={() => {}}
  />
);
ErroredMobile.globals = { sb_theme: 'stacked', viewport: { value: 'mobile1' } };
export const ErroredWithErrorOpen: StoryObj = {
  render: () => Errored(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByText('View error');
    await userEvent.click(button);
  },
};
export const ErroredMobileWithErrorOpen: StoryObj = {
  render: () => ErroredMobile(),
  globals: { sb_theme: 'stacked', viewport: { value: 'mobile1' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByText('View error');
    await userEvent.click(button);
  },
};
export const ErroredWithIndicatorOpen: StoryObj = {
  render: () => Errored(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button', { name: 'Extra actions' });
    await userEvent.click(button);
  },
};
export const ErroredMobileWithIndicatorOpen: StoryObj = {
  render: () => ErroredMobile(),
  globals: { sb_theme: 'stacked', viewport: { value: 'mobile1' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button', { name: 'Extra actions' });
    await userEvent.click(button);
  },
};
export const Auth = () => (
  <Ref
    {...refs.auth}
    hasEntries={true}
    isLoading={false}
    isBrowsing
    selectedStoryId=""
    highlightedRef={{ current: null }}
    setHighlighted={() => {}}
  />
);
export const Long = () => (
  <Ref
    {...refs.long}
    hasEntries={true}
    isLoading={false}
    isBrowsing
    selectedStoryId=""
    highlightedRef={{ current: null }}
    setHighlighted={() => {}}
  />
);

export const WithSourceCode = () => (
  <Ref
    {...refs.withSourceCode}
    hasEntries={true}
    isLoading={false}
    isBrowsing
    selectedStoryId=""
    highlightedRef={{ current: null }}
    setHighlighted={() => {}}
  />
);
