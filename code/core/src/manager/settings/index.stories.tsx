import React from 'react';

import { MemoryRouter } from 'storybook/internal/router';

import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, userEvent, waitFor } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';
import { defaultShortcuts } from './defaultShortcuts.tsx';
import { Pages } from './index.tsx';

const managerContext: any = {
  state: {},
  api: {
    getElements: fn(() => ({})).mockName('api::getElements'),
    getNavAvailability: fn(() => 'visible').mockName('api::getNavAvailability'),
    getShortcutKeys: fn(() => defaultShortcuts).mockName('api::getShortcutKeys'),
    getAddonsShortcutLabels: fn(() => ({})).mockName('api::getAddonsShortcutLabels'),
    setShortcut: fn().mockName('api::setShortcut'),
    restoreDefaultShortcut: fn().mockName('api::restoreDefaultShortcut'),
    restoreAllDefaultShortcuts: fn().mockName('api::restoreAllDefaultShortcuts'),
  },
};

const meta = preview.meta({
  component: Pages,
  args: {
    changeTab: fn(),
    onClose: fn(),
    enableWhatsNew: false,
  },
  parameters: {
    layout: 'fullscreen',
    path: '/settings/shortcuts',
  },
  decorators: [
    (Story, { parameters }) => (
      <MemoryRouter initialEntries={[`/?path=${parameters.path}`]}>
        <ManagerContext.Provider value={managerContext}>
          <div style={{ height: '100vh' }}>
            <Story />
          </div>
        </ManagerContext.Provider>
      </MemoryRouter>
    ),
  ],
});

/**
 * `/settings/` names no tab, so the tab list selects the first one by itself. That navigation must
 * replace the history entry, or Back would stop on the empty `/settings/` URL.
 */
export const DefaultTabReplacesHistoryEntry = meta.story({
  parameters: { path: '/settings/' },
  play: async ({ args }) => {
    await waitFor(() => expect(args.changeTab).toHaveBeenCalledWith('about', { replace: true }));
  },
});

/** Clicking a tab is a navigation of its own, so it keeps adding a history entry. */
export const ClickedTabAddsHistoryEntry = meta.story({
  play: async ({ args, canvas }) => {
    await userEvent.click(await canvas.findByRole('tab', { name: 'About' }));
    await expect(args.changeTab).toHaveBeenCalledWith('about', { replace: false });
    await expect(args.changeTab).toHaveBeenCalledTimes(1);
  },
});
