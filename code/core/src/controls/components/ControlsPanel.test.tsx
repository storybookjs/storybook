// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import { global } from '@storybook/global';

import { useServiceQuery } from 'storybook/manager-api';
import type { DocgenService } from 'storybook/open-service';
import { ThemeProvider, ensure, themes } from 'storybook/theming';

import { ControlsPanel } from './ControlsPanel.tsx';

const state = vi.hoisted(() => ({
  story: {
    id: 'button--primary',
    type: 'story',
    prepared: true,
    parameters: {},
    refId: undefined as string | undefined,
  },
  previewInitialized: false,
  refInitialized: false,
  rows: { label: { name: 'label', control: { type: 'text' } } },
}));

vi.mock('storybook/manager-api', () => ({
  useArgs: () => [{ label: 'Hello' }, vi.fn(), vi.fn(), { label: 'Hello' }],
  useGlobals: () => [{}],
  useArgTypes: () => state.rows,
  useParameter: () => ({}),
  useChannel: () => ({}),
  useStorybookApi: () => ({ getCurrentStoryData: () => state.story }),
  useStorybookState: () => ({
    path: '/story/button--primary',
    previewInitialized: state.previewInitialized,
    refs: { remote: { previewInitialized: state.refInitialized } },
  }),
  useServiceQuery: vi.fn(() => ({ data: undefined, isInitialLoading: false })),
}));

vi.mock('../../../../addons/docs/src/blocks/components/ArgsTable/ArgsTable.tsx', () => ({
  ArgsTable: ({ rows, isLoading }: { rows: unknown; isLoading: boolean }) => (
    <div data-testid="args-table" data-loading={String(isLoading)}>
      {JSON.stringify(rows)}
    </div>
  ),
}));
vi.mock('./SaveStory.tsx', () => ({ SaveStory: () => null }));

describe('ControlsPanel docgen ownership', () => {
  const docgenService = { queries: { docgen: {} } } as DocgenService;
  const props = { docgenService, saveStory: vi.fn(), createStory: vi.fn() };
  const originalConfigType = global.CONFIG_TYPE;

  beforeEach(() => {
    global.CONFIG_TYPE = 'PRODUCTION';
    state.story.refId = undefined;
    state.previewInitialized = false;
    state.refInitialized = false;
  });
  afterEach(() => {
    cleanup();
    global.CONFIG_TYPE = originalConfigType;
  });
  const panel = () => (
    <ThemeProvider theme={ensure(themes.light)}>
      <ControlsPanel {...props} />
    </ThemeProvider>
  );

  it('queries host docgen for a local story', () => {
    render(panel());
    expect(useServiceQuery).toHaveBeenCalledWith(docgenService.queries.docgen, { id: 'button' });
  });

  it.each(['DEVELOPMENT', 'PRODUCTION'] as const)(
    'uses ref preview argTypes in %s without querying host docgen, even when component IDs collide',
    (configType) => {
      global.CONFIG_TYPE = configType;
      state.story.refId = 'remote';
      state.refInitialized = true;
      render(panel());
      expect(useServiceQuery).not.toHaveBeenCalled();
      expect(screen.getByTestId('args-table')).toHaveTextContent(JSON.stringify(state.rows));
      expect(screen.getByTestId('args-table')).toHaveAttribute('data-loading', 'false');
    }
  );

  it('waits for the ref preview, not the host preview, to initialize', () => {
    state.story.refId = 'remote';
    state.previewInitialized = true;
    const { rerender } = render(panel());
    expect(screen.getByTestId('args-table')).toHaveAttribute('data-loading', 'true');
    state.refInitialized = true;
    rerender(panel());
    expect(screen.getByTestId('args-table')).toHaveAttribute('data-loading', 'false');
    expect(useServiceQuery).not.toHaveBeenCalled();
  });

  it('switches between host docgen and ref argTypes without querying the ref ID locally', () => {
    const { rerender } = render(panel());
    vi.mocked(useServiceQuery).mockClear();
    state.story.refId = 'remote';
    state.refInitialized = true;
    rerender(panel());
    expect(useServiceQuery).not.toHaveBeenCalled();
    expect(screen.getByTestId('args-table')).toHaveAttribute('data-loading', 'false');
    state.story.refId = undefined;
    rerender(panel());
    expect(useServiceQuery).toHaveBeenCalledWith(docgenService.queries.docgen, { id: 'button' });
  });
});
