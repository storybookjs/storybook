// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import { CircleHollowIcon, GrowIcon } from '@storybook/icons';

import { ThemeProvider, ensure, themes } from 'storybook/theming';

import type { ToolbarMenuProps } from '../types.ts';
import { ToolbarMenuSelect } from './ToolbarMenuSelect.tsx';

const mocks = vi.hoisted(() => ({
  globals: {} as Record<string, any>,
  storyGlobals: {} as Record<string, any>,
  updateGlobals: vi.fn(),
}));

vi.mock('storybook/manager-api', () => ({
  useStorybookApi: () => ({ setAddonShortcut: vi.fn() }),
  useGlobals: () => [mocks.globals, mocks.updateGlobals, mocks.storyGlobals],
}));

const baseProps: ToolbarMenuProps = {
  id: 'theme',
  name: 'Theme',
  description: 'Change the theme',
  toolbar: {
    title: 'Theme',
    items: [
      { type: 'item', value: 'light', title: 'Light', icon: GrowIcon },
      { type: 'item', value: 'dark', title: 'Dark' },
    ],
  },
};

const renderSelect = (props: Partial<ToolbarMenuProps> = {}) =>
  render(
    <ThemeProvider theme={ensure(themes.light)}>
      <ToolbarMenuSelect {...baseProps} {...props} />
    </ThemeProvider>
  );

describe('ToolbarMenuSelect', () => {
  afterEach(() => {
    cleanup();
    mocks.globals = {};
  });

  it('renders a toolbar icon component imported from @storybook/icons', () => {
    const { container } = renderSelect({
      toolbar: {
        title: 'Theme',
        icon: CircleHollowIcon,
        items: baseProps.toolbar.items,
      },
    });

    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders item icons imported from @storybook/icons in the open menu', async () => {
    const user = userEvent.setup();
    const { container } = renderSelect();

    // No toolbar icon and nothing selected, so any svg must come from the item icon.
    expect(container.querySelector('svg')).toBeNull();

    await user.click(screen.getByRole('button'));

    // The menu renders in a portal, so query the screen, not the container.
    const lightOption = screen.getByRole('option', { name: /light/i });
    expect(lightOption.querySelector('svg')).toBeTruthy();
  });

  it("renders the selected item's icon dynamically on the toolbar", () => {
    mocks.globals = { theme: 'light' };
    const { container } = renderSelect();

    expect(container.querySelector('svg')).toBeTruthy();
  });
});
