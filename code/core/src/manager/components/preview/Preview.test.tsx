// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import { SET_CURRENT_STORY } from 'storybook/internal/core-events';
import type { API_StoryEntry } from 'storybook/internal/types';

import { Preview } from './Preview';

type MockConsumerState = {
  customQueryParams: Record<string, never>;
  previewInitialized: boolean;
  refId: string;
  refs: Record<string, { previewInitialized: boolean }>;
  storyId: string;
  viewMode: 'story';
};

type MockApi = ReturnType<typeof createApi>;

let consumerState: MockConsumerState;
let consumerApi: MockApi;

vi.mock('storybook/internal/components', () => ({
  Loader: () => null,
  useTabsState: () => ({}),
}));

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../hooks/useLandmark', () => ({
  useLandmark: () => ({ landmarkProps: {} }),
}));

vi.mock('./FramesRenderer', () => ({
  FramesRenderer: () => null,
}));

vi.mock('./Toolbar', () => ({
  ToolbarComp: () => null,
}));

vi.mock('./Wrappers', () => ({
  ApplyWrappers: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./tools/zoom', () => ({
  ZoomProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ZoomConsumer: ({ children }: { children: (value: { value: number }) => React.ReactNode }) => (
    <>{children({ value: 1 })}</>
  ),
}));

vi.mock('./utils/components', () => {
  const FrameWrap = React.forwardRef<HTMLElement, { children: React.ReactNode }>((props, ref) => (
    <section ref={ref}>{props.children}</section>
  ));
  FrameWrap.displayName = 'FrameWrap';

  return {
    PreviewContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FrameWrap,
    CanvasWrap: ({ children, show }: { children: React.ReactNode; show: boolean }) =>
      show ? <div>{children}</div> : null,
    LoaderWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    IframeWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

vi.mock('storybook/manager-api', async () => ({
  Consumer: ({
    filter,
    children,
  }: {
    filter: (input: { state: MockConsumerState; api: MockApi }) => unknown;
    children: (value: unknown) => React.ReactNode;
  }) => <>{children(filter({ state: consumerState, api: consumerApi }))}</>,
  addons: { getChannel: () => ({ on: vi.fn() }) },
  merge: (...values: Record<string, unknown>[]) => Object.assign({}, ...values),
  types: { TAB: 'TAB' },
}));

const createEntry = (id = 'child-story--default'): Pick<API_StoryEntry, 'id' | 'refId'> =>
  ({ id, refId: 'child-ref' }) as Pick<API_StoryEntry, 'id' | 'refId'>;

const createApi = () => ({
  applyQueryParams: vi.fn(),
  emit: vi.fn(),
  getData: vi.fn(),
  getElements: vi.fn(),
  getShowToolbarWithCustomisations: vi.fn().mockReturnValue(false),
  renderPreview: undefined,
});

const createProps = (entry?: Pick<API_StoryEntry, 'id' | 'refId'>) => ({
  api: consumerApi,
  baseUrl: '/',
  description: 'Preview',
  entry,
  id: 'main',
  options: { showToolbar: false },
  storyId: 'child-story--default',
  tabId: undefined,
  tabs: [{ id: 'canvas', title: 'Canvas', render: () => null }],
  tools: [],
  toolsExtra: [],
  viewMode: 'story' as const,
  withLoader: false,
  wrappers: [],
});

describe('Preview', () => {
  beforeEach(() => {
    consumerApi = createApi();
    consumerState = {
      customQueryParams: {},
      previewInitialized: true,
      refId: 'child-ref',
      refs: { 'child-ref': { previewInitialized: true } },
      storyId: 'child-story--default',
      viewMode: 'story',
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('emits SET_CURRENT_STORY when a composed entry appears after the initial render', () => {
    const view = render(<Preview {...createProps(undefined)} />);

    expect(consumerApi.emit).not.toHaveBeenCalled();

    const entry = createEntry();
    consumerApi.getData.mockReturnValue(entry);

    view.rerender(<Preview {...createProps(entry)} />);

    expect(consumerApi.emit).toHaveBeenCalledWith(SET_CURRENT_STORY, {
      storyId: 'child-story--default',
      viewMode: 'story',
      options: { target: 'child-ref' },
    });
  });

  it('does not emit SET_CURRENT_STORY on the initial render when the entry is already ready', () => {
    const entry = createEntry();
    consumerApi.getData.mockReturnValue(entry);

    render(<Preview {...createProps(entry)} />);

    expect(consumerApi.emit).not.toHaveBeenCalled();
  });

  it('does not re-emit SET_CURRENT_STORY for rerenders of the same selection', () => {
    const entry = createEntry();
    consumerApi.getData.mockReturnValue(entry);

    const view = render(<Preview {...createProps(entry)} />);

    consumerApi.emit.mockClear();
    view.rerender(<Preview {...createProps(entry)} />);

    expect(consumerApi.emit).not.toHaveBeenCalled();
  });
});
