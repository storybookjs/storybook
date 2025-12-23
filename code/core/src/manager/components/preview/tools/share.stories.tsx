import React from 'react';

import { global } from '@storybook/global';

import type { StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { expect, screen, waitFor } from 'storybook/test';

import { shareTool } from './share';

const managerContext = {
  state: {
    storyId: 'manager-preview-tools-share--default',
    refId: undefined,
  },
  api: {
    getShortcutKeys: () => ({
      copyStoryLink: ['alt', 'shift', 'k'],
      openInIsolation: ['alt', 'shift', 'i'],
    }),
    getStoryHrefs: () => ({
      manager: '/?path=/story/manager-preview-tools-share--default',
      preview: '/iframe.html?id=manager-preview-tools-share--default&viewMode=story',
    }),
  },
} as any;

const ManagerDecorator = (Story: any) => (
  <ManagerContext.Provider value={managerContext}>
    <div style={{ padding: 24 }}>{Story()}</div>
  </ManagerContext.Provider>
);

const meta = {
  title: 'Manager/Preview/Tools/Share',
  render: shareTool.render,
  decorators: [ManagerDecorator],
  parameters: { layout: 'centered' },
  tags: ['!vitest'],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: () => {
    const originalConfigType = global.CONFIG_TYPE;
    global.STORYBOOK_NETWORK_ADDRESS = 'http://127.0.0.1:6006';
    global.CONFIG_TYPE = 'DEVELOPMENT';

    return () => {
      global.CONFIG_TYPE = originalConfigType;
    };
  },
  play: async ({ userEvent, canvas }) => {
    await waitFor(async () => {
      await userEvent.click(canvas.getByRole('button'));
      await expect(await screen.findByText('Scan to open')).toBeVisible();
    });
  },
};

export const Production: Story = {
  ...Default,
  beforeEach: () => {
    const originalConfigType = global.CONFIG_TYPE;
    global.STORYBOOK_NETWORK_ADDRESS = 'http://127.0.0.1:6006';
    global.CONFIG_TYPE = 'PRODUCTION';

    return () => {
      global.CONFIG_TYPE = originalConfigType;
    };
  },
};
