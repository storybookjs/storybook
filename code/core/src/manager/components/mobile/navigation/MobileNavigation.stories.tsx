import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { startCase } from 'es-toolkit/string';
import { ManagerContext } from 'storybook/manager-api';
import { fn, screen, userEvent } from 'storybook/test';

import { LayoutProvider, useLayout } from '../../layout/LayoutProvider';
import { MobileNavigation } from './MobileNavigation';

const MockMenu = () => {
  const { setMobileMenuOpen } = useLayout();
  return (
    <div>
      menu
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={() => setMobileMenuOpen(false)}
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

const mockManagerStore: any = {
  state: {
    index: {
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
    },
  },
  api: {
    getCurrentStoryData: fn(() => {
      return mockManagerStore.state.index.someStoryId;
    }),
  },
};

const meta = {
  component: MobileNavigation,
  title: 'Mobile/Navigation',
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={mockManagerStore}>
        <LayoutProvider>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100svh' }}>
            <div style={{ flex: 1 }} />
            {storyFn()}
          </div>
        </LayoutProvider>
      </ManagerContext.Provider>
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
  parameters: { chromatic: { disable: true } },
};

export const LongStoryName: Story = {
  decorators: [
    (storyFn) => {
      const mockManagerStoreWithLongNames: any = {
        state: {
          index: {
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
          },
        },
        api: {
          getCurrentStoryData() {
            return mockManagerStoreWithLongNames.state.index.someStoryId;
          },
        },
      };
      return (
        <ManagerContext.Provider value={mockManagerStoreWithLongNames}>
          {storyFn()}
        </ManagerContext.Provider>
      );
    },
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
