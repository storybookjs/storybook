import type { FC, PropsWithChildren } from 'react';
import React, { useMemo, useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { CircleHollowIcon, GrowIcon } from '@storybook/icons';

import { ManagerContext } from 'storybook/manager-api';
import { expect, screen, userEvent, waitFor } from 'storybook/test';

import type { ToolbarItem } from '../types.ts';
import { ToolbarMenuSelect } from './ToolbarMenuSelect.tsx';

const items: ToolbarItem[] = [
  { type: 'item', value: 'light', title: 'Light', icon: GrowIcon },
  { type: 'item', value: 'dark', title: 'Dark', icon: CircleHollowIcon },
];

/**
 * Reactive mock of `ManagerContext`. `ToolbarMenuSelect` reads the selected value via `useGlobals`
 * (i.e. `api.getGlobals`) and writes selections back through `api.updateGlobals`, so the mock owns
 * `globals` in React state and re-renders consumers when they change.
 */
const MockManagerProvider: FC<PropsWithChildren<{ globals?: Record<string, string> }>> = ({
  children,
  globals: initialGlobals = {},
}) => {
  const [globals, setGlobals] = useState(initialGlobals);

  // Mirrors the full API type, which is not worth it for a mock (same pattern as MobileNavigation).
  const value: any = useMemo(() => {
    const api = {
      getGlobals: () => globals,
      getUserGlobals: () => globals,
      getStoryGlobals: () => ({}),
      updateGlobals: (newGlobals: Record<string, string>) =>
        setGlobals((previous) => ({ ...previous, ...newGlobals })),
    };
    return { api, state: { globals } };
  }, [globals]);

  return <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>;
};

const meta = {
  title: 'Toolbar/ToolbarMenuSelect',
  component: ToolbarMenuSelect,
  decorators: [(storyFn) => <MockManagerProvider>{storyFn()}</MockManagerProvider>],
  args: {
    id: 'theme',
    name: 'Theme',
    description: 'Change the theme',
    toolbar: { title: 'Theme', items },
  },
} satisfies Meta<typeof ToolbarMenuSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ToolbarIcon: Story = {
  tags: ['vitest'],
  args: {
    toolbar: { title: 'Theme', icon: CircleHollowIcon, items },
  },
  play: async ({ canvas }) => {
    // The toolbar icon is an individually imported @storybook/icons component.
    const button = canvas.getByRole('button', { name: 'Change the theme' });
    expect(button.querySelector('svg')).not.toBeNull();
  },
};

export const ItemIcons: Story = {
  tags: ['vitest'],
  play: async ({ canvas }) => {
    // No toolbar icon and nothing selected, so any svg on the button must come from an item.
    const button = canvas.getByRole('button', { name: 'Change the theme' });
    expect(button.querySelector('svg')).toBeNull();

    await userEvent.click(button);

    // The menu renders in a portal, so query the screen, not the canvas.
    expect(screen.getByRole('option', { name: /light/i }).querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('option', { name: /dark/i }).querySelector('svg')).not.toBeNull();
  },
};

export const SelectedItemIcon: Story = {
  tags: ['vitest'],
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Change the theme' });
    expect(button.querySelector('svg')).toBeNull();

    await userEvent.click(button);
    await userEvent.click(screen.getByRole('option', { name: /light/i }));

    // Selecting an item swaps its icon onto the toolbar button and shows its title.
    const selectedButton = await canvas.findByRole('button', { name: 'Change the theme Light' });
    expect(selectedButton.querySelector('svg')).not.toBeNull();
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: /light/i })).not.toBeInTheDocument();
    });
  },
};

export const PreventDynamicIcon: Story = {
  tags: ['vitest'],
  decorators: [
    (storyFn) => (
      <MockManagerProvider globals={{ theme: 'light' }}>{storyFn()}</MockManagerProvider>
    ),
  ],
  args: {
    toolbar: { title: 'Theme', preventDynamicIcon: true, items },
  },
  play: async ({ canvas }) => {
    // An item is selected, but preventDynamicIcon keeps its icon off the toolbar button.
    const button = canvas.getByRole('button', { name: 'Change the theme Light' });
    expect(button.querySelector('svg')).toBeNull();
  },
};
