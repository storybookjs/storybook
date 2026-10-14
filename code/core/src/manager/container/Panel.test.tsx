// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import { STORY_PREPARED } from '../../core-events/index.ts';
import Panel from './Panel.tsx';

const mocks = vi.hoisted(() => {
  const channelHandlers: Record<string, (data?: unknown) => void> = {};
  return {
    channelHandlers,
    getCurrentStoryData: vi.fn<() => unknown>(),
    getElements: vi.fn<() => unknown>(),
    getSelectedPanel: vi.fn<() => string | null>(() => null),
  };
});

vi.mock('storybook/manager-api', () => ({
  useChannel: (handlers: Record<string, (data?: unknown) => void>) => {
    Object.assign(mocks.channelHandlers, handlers);
  },
  useStorybookApi: () => ({
    getCurrentStoryData: mocks.getCurrentStoryData,
    getElements: mocks.getElements,
    getSelectedPanel: mocks.getSelectedPanel,
    getShortcutKeys: () => ({}),
    setSelectedPanel: () => {},
  }),
  useStorybookState: () => ({ layout: { panelPosition: 'bottom' } }),
}));

// Stands in for the AddonPanel view: renders the panel ids the tab strip is told
// to show, so tests assert the container's panel selection directly.
vi.mock('../components/panel/Panel.tsx', () => ({
  AddonPanel: (props: { panels: Record<string, unknown> }) => {
    const { panels } = props;
    return React.createElement(
      'div',
      { 'data-testid': 'panel-ids' },
      Object.keys(panels).sort().join(',')
    );
  },
}));

const OPEN_SERVICE_PANEL_ID = 'storybook/internal/open-service-sync-demo/panel';

// Mirrors the internal demo addon's panel: hidden unless the story parameters
// enable `openServiceDemo` (see shared/open-service/sync-test/addon/manager.tsx).
const openServicePanel = {
  title: 'Open Service',
  paramKey: 'openServiceDemo',
  disabled: (parameters: Record<string, unknown> | undefined) => {
    const config = parameters?.openServiceDemo as { enabled?: boolean } | undefined;
    return !config?.enabled;
  },
};

const prepareStory = (story: unknown) => {
  mocks.getCurrentStoryData.mockReturnValue(story);
  act(() => {
    mocks.channelHandlers[STORY_PREPARED]?.();
  });
};

describe('Panel container', () => {
  afterEach(() => {
    cleanup();
    mocks.channelHandlers = {};
  });

  it('renders no panels before a story is prepared', () => {
    mocks.getCurrentStoryData.mockReturnValue(undefined);
    mocks.getElements.mockReturnValue({
      [OPEN_SERVICE_PANEL_ID]: openServicePanel,
      'storybook/internal/other': { title: 'Other' },
    });

    render(<Panel />);

    expect(screen.getByTestId('panel-ids').textContent).toBe('');
  });

  it('hides the demo panel for a prepared story without openServiceDemo parameters', () => {
    mocks.getCurrentStoryData.mockReturnValue(undefined);
    mocks.getElements.mockReturnValue({
      [OPEN_SERVICE_PANEL_ID]: openServicePanel,
      'storybook/internal/other': { title: 'Other' },
    });

    render(<Panel />);

    prepareStory({ type: 'story', parameters: {} });

    expect(screen.getByTestId('panel-ids').textContent).toBe('storybook/internal/other');
  });

  it('shows the demo panel for a prepared story with openServiceDemo enabled', () => {
    mocks.getCurrentStoryData.mockReturnValue(undefined);
    mocks.getElements.mockReturnValue({
      [OPEN_SERVICE_PANEL_ID]: openServicePanel,
      'storybook/internal/other': { title: 'Other' },
    });

    render(<Panel />);

    prepareStory({ type: 'story', parameters: { openServiceDemo: { enabled: true } } });

    expect(screen.getByTestId('panel-ids').textContent).toBe(
      'storybook/internal/open-service-sync-demo/panel,storybook/internal/other'
    );
  });

  it('renders no panels before prepare and keeps statically disabled panels hidden after', () => {
    mocks.getCurrentStoryData.mockReturnValue(undefined);
    mocks.getElements.mockReturnValue({
      'storybook/internal/statically-disabled': { title: 'Disabled', disabled: true },
      'storybook/internal/other': { title: 'Other' },
    });

    render(<Panel />);

    expect(screen.getByTestId('panel-ids').textContent).toBe('');

    prepareStory({ type: 'story', parameters: {} });

    expect(screen.getByTestId('panel-ids').textContent).toBe('storybook/internal/other');
  });
});
