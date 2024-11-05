import React from 'react';

import { fn } from '@storybook/test';

import { ManagerContext } from '@storybook/core/manager-api';

import { standardData as standardHeaderData } from './Heading.stories';
import { IconSymbols } from './IconSymbols';
import { Ref } from './Refs';
import { mockDataset } from './mockdata';
import type { RefType } from './types';

const managerContext: any = {
  api: {
    emit: fn().mockName('api::emit'),
    on: fn().mockName('api::on'),
    off: fn().mockName('api::off'),
  },
  state: {
    docsOptions: {},
  },
};

export default {
  component: Ref,
  title: 'Sidebar/Refs',
  excludeStories: /.*Data$/,
  parameters: { layout: 'fullscreen' },
  globals: { sb_theme: 'side-by-side' },
  decorators: [
    (storyFn: any) => (
      <ManagerContext.Provider value={managerContext}>
        <IconSymbols />
        {storyFn()}
      </ManagerContext.Provider>
    ),
    (storyFn: any) => <div style={{ padding: '0 20px', maxWidth: '230px' }}>{storyFn()}</div>,
  ],
};

const { menu } = standardHeaderData;
const index = mockDataset.withRoot;
const storyId = '1-12-121';

export const simpleData = { menu, index, storyId };
export const loadingData = { menu, index: {} };

// @ts-expect-error (non strict)
const indexError: Error = (() => {
  try {
    throw new Error('There was a severe problem');
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
    index,
  },
  empty: {
    id: 'empty',
    title: 'It is empty because no stories were loaded',
    url: 'https://example.com',
    type: 'lazy',
    index: {},
    previewInitialized: false,
  },
  startInjected_unknown: {
    id: 'startInjected_unknown',
    title: 'It started injected and is unknown',
    url: 'https://example.com',
    type: 'unknown',
    previewInitialized: false,
    // @ts-expect-error (invalid input)
    index,
  },
  startInjected_loading: {
    id: 'startInjected_loading',
    title: 'It started injected and is loading',
    url: 'https://example.com',
    type: 'auto-inject',
    previewInitialized: false,
    // @ts-expect-error (invalid input)
    index,
  },
  startInjected_ready: {
    id: 'startInjected_ready',
    title: 'It started injected and is ready',
    url: 'https://example.com',
    type: 'auto-inject',
    previewInitialized: true,
    // @ts-expect-error (invalid input)
    index,
  },
  versions: {
    id: 'versions',
    title: 'It has versions',
    url: 'https://example.com',
    type: 'lazy',
    // @ts-expect-error (invalid input)
    index,
    versions: { '1.0.0': 'https://example.com/v1', '2.0.0': 'https://example.com' },
    previewInitialized: true,
  },
  versionsMissingCurrent: {
    id: 'versions_missing_current',
    title: 'It has versions',
    url: 'https://example.com',
    type: 'lazy',
    // @ts-expect-error (invalid input)
    index,
    versions: { '1.0.0': 'https://example.com/v1', '2.0.0': 'https://example.com/v2' },
    previewInitialized: true,
  },
  error: {
    id: 'error',
    title: 'This has problems',
    url: 'https://example.com',
    type: 'lazy',
    indexError,
    previewInitialized: true,
  },
  auth: {
    id: 'Authentication',
    title: 'This requires a login',
    url: 'https://example.com',
    type: 'lazy',
    loginUrl: 'https://example.com',
    previewInitialized: true,
  },
  long: {
    id: 'long',
    title: 'This storybook has a very very long name for some reason',
    url: 'https://example.com',
    // @ts-expect-error (invalid input)
    index,
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
    index,
  },
};

export const Optimized = () => (
  <Ref
    {...refs.optimized}
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
    isLoading={false}
    isBrowsing
    selectedStoryId=""
    highlightedRef={{ current: null }}
    setHighlighted={() => {}}
  />
);
export const Auth = () => (
  <Ref
    {...refs.auth}
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
    isLoading={false}
    isBrowsing
    selectedStoryId=""
    highlightedRef={{ current: null }}
    setHighlighted={() => {}}
  />
);
