// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import * as InternalComponents from 'storybook/internal/components';
import { SET_CURRENT_STORY } from 'storybook/internal/core-events';
import type { API_StoryEntry } from 'storybook/internal/types';
import * as ManagerApi from 'storybook/manager-api';
import { HelmetProvider } from 'react-helmet-async';

import * as useLandmarkModule from '../../hooks/useLandmark';
import * as FramesRendererModule from './FramesRenderer';
import { Preview } from './Preview';

type MockConsumerState = {
  customQueryParams: Record<string, never>;
  previewInitialized: boolean;
  refId: string;
  refs: Record<string, { previewInitialized: boolean }>;
  storyId: string;
  viewMode: 'docs' | 'story';
};

type MockApi = ReturnType<typeof createApi>;

let consumerState: MockConsumerState;
let consumerApi: MockApi;
let currentEntry: Pick<API_StoryEntry, 'id' | 'refId'> | undefined;

vi.mock('storybook/internal/components', { spy: true });
vi.mock('../../hooks/useLandmark', { spy: true });
vi.mock('./FramesRenderer', { spy: true });
vi.mock('./Toolbar', { spy: true });
vi.mock('./Wrappers', { spy: true });
vi.mock('./utils/components', { spy: true });
vi.mock('storybook/manager-api', { spy: true });

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

const createProps = (
  entry?: Pick<API_StoryEntry, 'id' | 'refId'>,
  viewMode: 'docs' | 'story' = 'story'
) => ({
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
  viewMode,
  withLoader: false,
  wrappers: [],
});

const renderPreview = (
  entry?: Pick<API_StoryEntry, 'id' | 'refId'>,
  viewMode: 'docs' | 'story' = 'story'
) =>
  render(
    <HelmetProvider>
      <Preview {...createProps(entry, viewMode)} />
    </HelmetProvider>
  );

describe('Preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    consumerApi = createApi();
    currentEntry = undefined;
    consumerState = {
      customQueryParams: {},
      previewInitialized: true,
      refId: 'child-ref',
      refs: { 'child-ref': { previewInitialized: true } },
      storyId: 'child-story--default',
      viewMode: 'story',
    };

    vi.mocked(InternalComponents.useTabsState).mockReturnValue({} as never);
    consumerApi.getData.mockImplementation(() => currentEntry as never);

    vi.mocked(useLandmarkModule.useLandmark).mockReturnValue({ landmarkProps: {} } as never);
    vi.mocked(FramesRendererModule.FramesRenderer).mockImplementation(
      function FramesRendererMock() {
        return null;
      }
    );
    vi.mocked(ManagerApi.Consumer).mockImplementation(function ConsumerMock({
      filter,
      children,
    }: {
      filter: (input: { state: MockConsumerState; api: MockApi }) => unknown;
      children: (value: unknown) => React.ReactNode;
    }) {
      return <>{children(filter({ state: consumerState, api: consumerApi }))}</>;
    });
    vi.spyOn(ManagerApi.addons, 'getChannel').mockReturnValue({ on: vi.fn() } as never);
  });

  afterEach(() => {
    cleanup();
  });

  it('emits SET_CURRENT_STORY when a composed entry appears after the initial render', () => {
    const view = renderPreview(undefined);

    expect(consumerApi.emit).not.toHaveBeenCalled();

    const entry = createEntry();
    currentEntry = entry;

    view.rerender(
      <HelmetProvider>
        <Preview {...createProps(entry)} />
      </HelmetProvider>
    );

    expect(consumerApi.emit).toHaveBeenCalledWith(SET_CURRENT_STORY, {
      storyId: 'child-story--default',
      viewMode: 'story',
      options: { target: 'child-ref' },
    });
  });

  it('does not emit SET_CURRENT_STORY on the initial render when the entry is already ready', () => {
    const entry = createEntry();
    currentEntry = entry;

    renderPreview(entry);

    expect(consumerApi.emit).not.toHaveBeenCalled();
  });

  it('emits SET_CURRENT_STORY when the same composed entry rerenders in docs mode', () => {
    const entry = createEntry();
    currentEntry = entry;

    const view = renderPreview(entry);

    expect(consumerApi.emit).not.toHaveBeenCalled();

    consumerState.viewMode = 'docs';
    view.rerender(
      <HelmetProvider>
        <Preview {...createProps(entry, 'docs')} />
      </HelmetProvider>
    );

    expect(consumerApi.emit).toHaveBeenCalledWith(SET_CURRENT_STORY, {
      storyId: 'child-story--default',
      viewMode: 'docs',
      options: { target: 'child-ref' },
    });
  });

  it('does not re-emit SET_CURRENT_STORY for rerenders of the same selection', () => {
    const entry = createEntry();
    currentEntry = entry;

    const view = renderPreview(entry);

    consumerApi.emit.mockClear();
    view.rerender(
      <HelmetProvider>
        <Preview {...createProps(entry)} />
      </HelmetProvider>
    );

    expect(consumerApi.emit).not.toHaveBeenCalled();
  });
});
