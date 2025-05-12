import React from 'react';

import { Explorer } from './Explorer';
import { IconSymbols } from './IconSymbols';
import * as RefStories from './Refs.stories';
import { mockDataset } from './mockdata';
import type { RefType } from './types';

export default {
  component: Explorer,
  title: 'Sidebar/Explorer',
  globals: { sb_theme: 'side-by-side' },
  parameters: { layout: 'fullscreen' },
  decorators: [
    RefStories.default.decorators[0],
    (storyFn: any) => (
      <div style={{ padding: '0 20px', maxWidth: '230px' }}>
        <IconSymbols />
        {storyFn()}
      </div>
    ),
  ],
};

const selected = {
  refId: 'storybook_internal',
  storyId: 'root-1-child-a2--grandchild-a1-1',
};

const simple: Record<string, RefType> = {
  storybook_internal: {
    title: undefined,
    id: 'storybook_internal',
    url: 'iframe.html',
    previewInitialized: true,
    // @ts-expect-error (invalid input)
    filteredIndex: mockDataset.withRoot,
  },
};

const withRefs: Record<string, RefType> = {
  ...simple,
  basic: {
    id: 'basic',
    title: 'Basic ref',
    url: 'https://example.com',
    previewInitialized: true,
    type: 'auto-inject',
    // @ts-expect-error (invalid input)
    filteredIndex: mockDataset.noRoot,
  },
  injected: {
    id: 'injected',
    title: 'Not ready',
    url: 'https://example.com',
    previewInitialized: false,
    type: 'auto-inject',
    // @ts-expect-error (invalid input)
    filteredIndex: mockDataset.noRoot,
  },
  unknown: {
    id: 'unknown',
    title: 'Unknown ref',
    url: 'https://example.com',
    previewInitialized: true,
    type: 'unknown',
    // @ts-expect-error (invalid input)
    filteredIndex: mockDataset.noRoot,
  },
  lazy: {
    id: 'lazy',
    title: 'Lazy loaded ref',
    url: 'https://example.com',
    previewInitialized: false,
    type: 'lazy',
    // @ts-expect-error (invalid input)
    filteredIndex: mockDataset.withRoot,
  },
};

export const Simple = () => (
  <Explorer
    dataset={{ hash: simple, entries: Object.entries(simple) }}
    selected={selected}
    isLoading={false}
    isBrowsing
  />
);

export const WithRefs = () => (
  <Explorer
    dataset={{ hash: withRefs, entries: Object.entries(withRefs) }}
    selected={selected}
    isLoading={false}
    isBrowsing
  />
);
