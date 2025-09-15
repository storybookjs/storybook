import React from 'react';

import type { StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { expect, screen } from 'storybook/test';

import { shareTool } from './share';

const managerContext: any = {
  state: {
    storyId: 'manager-preview-tools-share--default',
    refId: undefined,
    refs: {},
    customQueryParams: {},
  },
  api: {
    getShortcutKeys: () => ({ copyStoryLink: ['meta', 'shift', 'c'] }),
  },
};

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
  play: async ({ userEvent, canvas }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(await screen.findByText('Scan me')).toBeVisible();
  },
};
