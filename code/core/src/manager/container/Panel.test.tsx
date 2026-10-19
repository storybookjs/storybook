// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import { STORY_PREPARED } from '../../core-events/index.ts';
import { ThemeProvider, ensure, themes } from 'storybook/theming';
import type { Theme } from 'storybook/theming';

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

// Generic fixtures exercise the container's filtering contract without tying
// the tests to an internal demo addon.
const flaggedPanel = {
  title: 'Flagged',
  paramKey: 'flag',
  render: () => null,
  disabled: (parameters: Record<string, unknown> | undefined) =>
    !(parameters?.flag as { enabled?: boolean } | undefined)?.enabled,
};
const staticallyDisabledPanel = { title: 'Disabled', render: () => null, disabled: true };
const plainPanel = { title: 'Plain', render: () => null };

const prepareStory = (story: unknown) => {
  mocks.getCurrentStoryData.mockReturnValue(story);
  act(() => {
    mocks.channelHandlers[STORY_PREPARED]?.();
  });
};

// Tab titles from the real AddonPanel's DOM. Asserted via DOM presence rather
// than role queries: happy-dom computes StatelessTab as display:none, which
// excludes it from the accessibility tree that getByRole matches against.
const tabTitles = () =>
  Array.from(document.querySelectorAll('[role="tab"]')).map((el) => el.textContent);

const theme: Theme = ensure(themes.light);
const renderPanel = () =>
  render(
    <ThemeProvider theme={theme}>
      <Panel />
    </ThemeProvider>
  );

describe('Panel container', () => {
  beforeEach(() => {
    mocks.getCurrentStoryData.mockReturnValue(undefined);
    mocks.getElements.mockReturnValue({
      'storybook/internal/flagged': flaggedPanel,
      'storybook/internal/static': staticallyDisabledPanel,
      'storybook/internal/plain': plainPanel,
    });
  });

  afterEach(() => {
    cleanup();
    mocks.channelHandlers = {};
  });

  it('hides panels disabled for undefined parameters before a story is prepared, keeps others', () => {
    renderPanel();

    expect(tabTitles()).toEqual(['Plain']);
    // The "Storybook add-ons" empty state means "no addons installed", not
    // "story loading": surviving panels must be visible and mounted from boot.
    expect(screen.queryByText('Storybook add-ons')).toBeNull();
  });

  it('hides the parameter-gated panel for a prepared story without flag parameters', () => {
    renderPanel();

    prepareStory({ type: 'story', parameters: {} });

    expect(tabTitles()).toContain('Plain');
    expect(tabTitles()).not.toContain('Flagged');
  });

  it('shows the parameter-gated panel for a prepared story with flag enabled', () => {
    renderPanel();

    prepareStory({ type: 'story', parameters: { flag: { enabled: true } } });

    expect(tabTitles()).toContain('Flagged');
  });

  it('keeps statically disabled panels hidden before and after a story is prepared', () => {
    renderPanel();

    expect(tabTitles()).not.toContain('Disabled');

    prepareStory({ type: 'story', parameters: {} });

    expect(tabTitles()).not.toContain('Disabled');
    expect(tabTitles()).toContain('Plain');
  });
});
