// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import * as api from 'storybook/manager-api';

import Panel from './Panel.tsx';

vi.mock('storybook/manager-api');
vi.mock('../components/panel/Panel.tsx', () => ({
  AddonPanel: ({ panels }: any) => <div data-testid="panels">{Object.keys(panels).join(',')}</div>,
}));

const mockedApi = vi.mocked(api);

const panels = {
  always: { id: 'always', type: 'panel' },
  optIn: {
    id: 'optIn',
    type: 'panel',
    disabled: (parameters: any) => !parameters?.docs?.codePanel,
  },
} as any;

const renderWith = (story: any) => {
  mockedApi.useStorybookApi.mockReturnValue({
    getElements: () => panels,
    getCurrentStoryData: () => story,
    getSelectedPanel: () => 'always',
    getShortcutKeys: () => ({}),
    setSelectedPanel: vi.fn(),
    getIsPanelShown: () => true,
    togglePanel: vi.fn(),
    togglePanelPosition: vi.fn(),
    focusOnUIElement: vi.fn(),
  } as any);
  mockedApi.useStorybookState.mockReturnValue({ layout: { panelPosition: 'bottom' } } as any);
  mockedApi.useChannel.mockReturnValue(vi.fn() as any);

  return render(<Panel />).getByTestId('panels').textContent;
};

describe('Panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('hides a panel whose disabled predicate rejects the story parameters', () => {
    expect(renderWith({ type: 'story', parameters: {} })).toBe('always');
  });

  it('shows a panel that the story opts into', () => {
    expect(renderWith({ type: 'story', parameters: { docs: { codePanel: true } } })).toBe(
      'always,optIn'
    );
  });

  // The panel set is also filtered before a story resolves, otherwise an opt-in
  // panel is rendered until the parameters arrive.
  it('hides an opt-in panel when there is no story data yet', () => {
    expect(renderWith(undefined)).toBe('always');
  });

  it('hides an opt-in panel on a docs entry', () => {
    expect(renderWith({ type: 'docs' })).toBe('always');
  });
});
