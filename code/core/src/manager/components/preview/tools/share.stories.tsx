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
    refs: {},
    customQueryParams: {},
  },
  api: {
    getShortcutKeys: () => ({ copyStoryLink: ['alt', 'shift', 'k'] }),
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
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: () => {
    global.STORYBOOK_NETWORK_ADDRESS = 'http://127.0.0.1:6006';
  },
  play: async ({ userEvent, canvas }) => {
    await waitFor(async () => {
      await userEvent.click(canvas.getByRole('button'));
      await expect(await screen.findByText('Scan me')).toBeVisible();
    });
  },
};
