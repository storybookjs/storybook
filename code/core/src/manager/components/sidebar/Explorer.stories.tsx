import React from 'react';
import type { PlayFunction } from 'storybook/internal/csf';
import { expect } from 'storybook/test';

import { Explorer } from './Explorer.tsx';
import { IconSymbols } from './IconSymbols.tsx';
import * as RefStories from './Refs.stories.tsx';
import { mockDataset } from './mockdata.ts';
import type { RefType } from './types.ts';

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
    selected={{
      refId: 'storybook_internal',
      storyId: 'root-1-child-a2--grandchild-a1-1:test1',
    }}
    isLoading={false}
    isBrowsing
    hasEntries={true}
    isHidden={false}
  />
);

export const WithRefs = () => (
  <Explorer
    dataset={{ hash: withRefs, entries: Object.entries(withRefs) }}
    selected={{
      refId: 'storybook_internal',
      storyId: 'root-1-child-a2--grandchild-a1-1',
    }}
    isLoading={false}
    isBrowsing
    hasEntries={true}
    isHidden={false}
  />
);

const idlessRefs: Record<string, RefType> = {
  idless: {
    title: 'Id-less ref',
    url: 'https://example.com',
    previewInitialized: true,
    type: 'unknown',
    // @ts-expect-error (invalid input)
    id: undefined,
    // @ts-expect-error (invalid input)
    filteredIndex: mockDataset.noRoot,
  },
};

// Regression: an id-less ref with no selection used to crash the sidebar with
// "Cannot read properties of null (reading 'storyId')", because
// `selected?.refId === ref.id` matched `undefined === undefined`. getRefs now
// only produces refs with lowercase string ids, so the Explorer guard is
// defence in depth and this story pins that it holds.
export const IdlessRefWithoutSelection = {
  render: () => (
    <Explorer
      dataset={{ hash: idlessRefs, entries: Object.entries(idlessRefs) }}
      selected={null}
      isLoading={false}
      isBrowsing
      hasEntries={true}
      isHidden={false}
    />
  ),
  play: (async ({ canvas }) => {
    await expect(await canvas.findByText('Id-less ref')).toBeInTheDocument();
  }) satisfies PlayFunction,
};
