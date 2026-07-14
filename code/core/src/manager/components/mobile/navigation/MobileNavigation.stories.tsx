import type { FC, PropsWithChildren } from 'react';
import React, { useEffect, useMemo, useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { startCase } from 'es-toolkit/string';
import { ManagerContext, useStorybookApi } from 'storybook/manager-api';
import { expect, fn, screen, userEvent } from 'storybook/test';

import { LayoutProvider, useLayout } from '../../layout/LayoutProvider.tsx';
import { MobileNavigation } from './MobileNavigation.tsx';

const MockMenu = () => {
  const api = useStorybookApi();
  return (
    <div>
      menu
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={() => api.setMobileNavigation(false)}
      >
        close
      </button>
    </div>
  );
};

const MockPanel = () => {
  const { setMobilePanelOpen } = useLayout();
  return (
    <div>
      panel
      <button
        type="button"
        aria-label="Close addon panel"
        onClick={() => setMobilePanelOpen(false)}
      >
        close
      </button>
    </div>
  );
};

const renderLabel = ({ name }: { name: string }) => startCase(name);

const baseIndex = {
  someRootId: {
    type: 'root',
    id: 'someRootId',
    name: 'root',
    renderLabel,
  },
  someComponentId: {
    type: 'component',
    id: 'someComponentId',
    name: 'component',
    parent: 'someRootId',
    renderLabel,
  },
  someStoryId: {
    type: 'story',
    subtype: 'story',
    id: 'someStoryId',
    name: 'story',
    parent: 'someComponentId',
    renderLabel,
  },
};

/**
 * The live mock `api` for the default decorator, so play functions can drive the same mobile path
 * the sidebar keyboard shortcut uses (`api.toggleNav()`), like the real manager API.
 */
let defaultApi: {
  toggleNav: (nextState?: boolean) => void;
  setMobileNavigation: (show: boolean) => void;
} | null = null;

/**
 * Reactive mock of `ManagerContext`. The mobile drawer reads its open state from
 * `layout.showMobileNavigation`, so the mock owns that field in React state and exposes `toggleNav`
 * / `setMobileNavigation` that update it, mirroring the real store behavior on mobile. `ui` is
 * stubbed because the bottom bar reads `enableShortcuts` from the store.
 */
const MockManagerProvider: FC<
  PropsWithChildren & { index?: typeof baseIndex; exposeApi?: boolean }
> = ({ children, index = baseIndex, exposeApi = false }) => {
  const [showMobileNavigation, setShowMobileNavigation] = useState(false);

  const value: any = useMemo(() => {
    const api = {
      getCurrentStoryData: fn(() => index.someStoryId),
      getShortcutKeys: () => ({ toggleNav: ['alt', 'S'] }),
      setMobileNavigation: (show: boolean) => setShowMobileNavigation(show),
      toggleNav: (nextState?: boolean) =>
        setShowMobileNavigation((open) => (typeof nextState === 'boolean' ? nextState : !open)),
    };
    return {
      state: {
        index,
        layout: { showMobileNavigation },
        ui: { enableShortcuts: true },
      },
      api,
    };
  }, [index, showMobileNavigation, exposeApi]);

  // Expose the live api for the shortcut story on commit, not during render.
  useEffect(() => {
    if (exposeApi) {
      defaultApi = value.api;
    }
  }, [exposeApi, value]);

  return <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>;
};

const meta = {
  component: MobileNavigation,
  title: 'Mobile/Navigation',
  decorators: [
    (storyFn) => (
      <MockManagerProvider exposeApi>
        <LayoutProvider>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100svh' }}>
            <div style={{ flex: 1 }} />
            {storyFn()}
          </div>
        </LayoutProvider>
      </MockManagerProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'mobile1',
    },
    chromatic: { viewports: [320] },
  },
  args: {
    menu: <MockMenu />,
    panel: <MockPanel />,
    showPanel: true,
  },
} satisfies Meta<typeof MobileNavigation>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  globals: { sb_theme: 'light' },
};
export const Dark: Story = {
  globals: { sb_theme: 'dark' },
  parameters: { chromatic: { disableSnapshot: true } },
};

export const LongStoryName: Story = {
  decorators: [
    (storyFn) => (
      <MockManagerProvider
        index={
          {
            someRootId: {
              type: 'root',
              id: 'someRootId',
              name: 'someLongRootName',
              renderLabel,
            },
            someComponentId: {
              type: 'component',
              id: 'someComponentId',
              name: 'someComponentName',
              parent: 'someRootId',
              renderLabel,
            },
            someStoryId: {
              type: 'story',
              subtype: 'story',
              id: 'someStoryId',
              name: 'someLongStoryName',
              parent: 'someComponentId',
              renderLabel,
            },
          } as typeof baseIndex
        }
      >
        {storyFn()}
      </MockManagerProvider>
    ),
  ],
};

export const MenuOpen: Story = {
  play: async ({ canvas }) => {
    const menuOpen = await canvas.findByLabelText('Open navigation menu', {}, { timeout: 3000 });
    await userEvent.click(menuOpen);
  },
};

export const MenuClosed: Story = {
  play: async (context) => {
    // @ts-expect-error (non strict)
    await MenuOpen.play(context);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const overlay = await screen.findByLabelText('Close navigation menu');
    await userEvent.click(overlay);
  },
};

// Below the mobile breakpoint `api.toggleNav()` flips `layout.showMobileNavigation`, which the
// drawer reads as its single source of truth, so the sidebar keyboard shortcut opens the drawer on
// mobile too (regression test for #32278).
export const ToggleNavShortcut: Story = {
  play: async () => {
    await expect(screen.queryByLabelText('Close navigation menu')).not.toBeInTheDocument();

    expect(defaultApi).toBeTruthy();
    // Mirrors the mobile keyboard-shortcut path: `toggleNav()` sets the store field, opening the drawer.
    defaultApi?.toggleNav();

    const closeButton = await screen.findByLabelText(
      'Close navigation menu',
      {},
      { timeout: 3000 }
    );
    await expect(closeButton).toBeInTheDocument();
  },
};

export const PanelOpen: Story = {
  play: async ({ canvas }) => {
    const panelButton = await canvas.findByLabelText('Open addon panel', {}, { timeout: 3000 });
    await userEvent.click(panelButton);
  },
};

export const PanelClosed: Story = {
  play: async (context) => {
    // @ts-expect-error (non strict)
    await PanelOpen.play(context);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const closeButton = await screen.findByLabelText('Close addon panel');
    await userEvent.click(closeButton);
  },
};

export const PanelDisabled: Story = {
  args: {
    showPanel: false,
  },
};

export const ReactNodeRenderLabel: Story = {
  decorators: [
    (storyFn) => {
      const renderReactNodeLabel = ({ name }: { name: string }) => <em>{startCase(name)}</em>;

      return (
        <MockManagerProvider
          index={
            {
              someRootId: {
                type: 'root',
                id: 'someRootId',
                name: 'root',
                renderLabel: renderReactNodeLabel,
              },
              someComponentId: {
                type: 'component',
                id: 'someComponentId',
                name: 'component',
                parent: 'someRootId',
                renderLabel: renderReactNodeLabel,
              },
              someStoryId: {
                type: 'story',
                subtype: 'story',
                id: 'someStoryId',
                name: 'story',
                parent: 'someComponentId',
                renderLabel: renderReactNodeLabel,
              },
            } as unknown as typeof baseIndex
          }
        >
          {storyFn()}
        </MockManagerProvider>
      );
    },
  ],
};
