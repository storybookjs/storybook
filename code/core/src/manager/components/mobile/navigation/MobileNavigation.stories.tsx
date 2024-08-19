import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';
import { within } from '@storybook/test';

import { ManagerContext } from '@storybook/core/manager-api';

import { startCase } from 'lodash';

import { LayoutProvider, useLayout } from '../../layout/LayoutProvider';
import { MobileNavigation } from './MobileNavigation';

const MockPanel = () => {
  const { setMobilePanelOpen } = useLayout();
  return (
    <div>
      panel
      <button type="button" title="Close addon panel" onClick={() => setMobilePanelOpen(false)}>
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
        id: 'someStoryId',
        name: 'story',
        parent: 'someComponentId',
        renderLabel,
      },
    },
  },
  api: {
    getCurrentStoryData() {
      return mockManagerStore.state.index.someStoryId;
    },
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
    menu: <div>navigation menu</div>,
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
  play: async ({ canvasElement }) => {
    const menuOpen = await within(canvasElement).getByTitle('Open navigation menu');
    await menuOpen.click();
  },
};

export const MenuClosed: Story = {
  play: async (context) => {
    // @ts-expect-error (non strict)
    await MenuOpen.play(context);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const overlay = await within(context.canvasElement).getByLabelText('Close navigation menu');
    await overlay.click();
  },
};

export const PanelOpen: Story = {
  play: async ({ canvasElement }) => {
    const panelButton = await within(canvasElement).getByTitle('Open addon panel');
    await panelButton.click();
  },
};

export const PanelClosed: Story = {
  play: async (context) => {
    // @ts-expect-error (non strict)
    await PanelOpen.play(context);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const closeButton = await within(context.canvasElement).getByTitle('Close addon panel');
    await closeButton.click();
  },
};

export const PanelDisabled: Story = {
  args: {
    showPanel: false,
  },
};
