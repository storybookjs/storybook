import React from 'react';

import { global } from '@storybook/global';

import type { StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, screen, waitFor } from 'storybook/test';

import { shareTool } from './share';

const managerContext = {
  state: {
    storyId: 'manager-preview-tools-share--default',
    refId: undefined,
  },
  api: {
    emit: fn().mockName('api::emit'),
    getElements: () => ({
      id: {
        title: 'Share',
        render: () => (
          <div style={{ backgroundColor: 'white', padding: 10, borderRadius: 5 }}>
            Placeholder shareprovider content
          </div>
        ),
      },
    }),
    getShortcutKeys: () => ({
      copyStoryLink: ['alt', 'shift', 'l'],
      openInIsolation: ['alt', 'shift', 'i'],
    }),
    getStoryHrefs: () => ({
      managerHref: '/?path=/story/manager-preview-tools-share--default',
      previewHref: '/iframe.html?id=manager-preview-tools-share--default&viewMode=story',
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

export const Default: Story = {};

export const Open: Story = {
  play: async ({ userEvent, canvas }) => {
    await waitFor(async () => {
      await userEvent.click(canvas.getByRole('button'));
      await expect(await screen.findByText('Placeholder shareprovider content')).toBeVisible();
    });
  },
};
