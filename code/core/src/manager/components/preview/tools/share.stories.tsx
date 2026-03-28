import React from 'react';

import type { Addon_ShareSectionProps } from 'storybook/internal/types';
import { Addon_TypesEnum } from 'storybook/internal/types';

import { global } from '@storybook/global';

import type { StoryObj } from '@storybook/react-vite';

import { ManagerContext, addons } from 'storybook/manager-api';
import { expect, fn, screen, waitFor } from 'storybook/test';

import { shareTool } from './share';

const MockShareSection = ({ storyId, api }: Addon_ShareSectionProps) => (
  <div>
    Chromatic Section (mock)
    <span data-testid="share-section-story-id">{storyId}</span>
    <span data-testid="share-section-has-api">{api ? 'true' : 'false'}</span>
  </div>
);

const managerContext = {
  state: {
    storyId: 'manager-preview-tools-share--without-addon',
    refId: undefined,
  },
  api: {
    emit: fn().mockName('api::emit'),
    getShortcutKeys: () => ({
      copyStoryLink: ['alt', 'shift', 'l'],
      openInIsolation: ['alt', 'shift', 'i'],
    }),
    getStoryHrefs: () => ({
      managerHref: '/?path=/story/manager-preview-tools-share--without-addon',
      previewHref: '/iframe.html?id=manager-preview-tools-share--without-addon&viewMode=story',
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

export const WithoutAddon: Story = {
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
      await expect(await screen.findByText('Open in isolation mode')).toBeVisible();
      await expect(await screen.findByText('Scan to open')).toBeVisible();
      expect(screen.queryByText('Chromatic Section (mock)')).not.toBeInTheDocument();
    });
  },
};

export const WithAddon: Story = {
  beforeEach: () => {
    const originalConfigType = global.CONFIG_TYPE;
    global.STORYBOOK_NETWORK_ADDRESS = 'http://127.0.0.1:6006';
    global.CONFIG_TYPE = 'DEVELOPMENT';

    addons.add('mock-share-section', {
      type: Addon_TypesEnum.experimental_SHARE_SECTION,
      render: MockShareSection,
    });

    return () => {
      global.CONFIG_TYPE = originalConfigType;
      const elements = addons.getElements(Addon_TypesEnum.experimental_SHARE_SECTION);
      delete elements['mock-share-section'];
    };
  },
  play: async ({ userEvent, canvas }) => {
    await waitFor(async () => {
      await userEvent.click(canvas.getByRole('button'));
      await expect(await screen.findByText('Chromatic Section (mock)')).toBeVisible();
      await expect(await screen.findByText('Open in isolation mode')).toBeVisible();
      await expect(await screen.findByText('Scan to open')).toBeVisible();
      await expect(screen.getByTestId('share-section-story-id')).toHaveTextContent(
        'manager-preview-tools-share--without-addon'
      );
      await expect(screen.getByTestId('share-section-has-api')).toHaveTextContent('true');
    });
  },
};

export const Production: Story = {
  ...WithoutAddon,
  beforeEach: () => {
    const originalConfigType = global.CONFIG_TYPE;
    global.STORYBOOK_NETWORK_ADDRESS = 'http://127.0.0.1:6006';
    global.CONFIG_TYPE = 'PRODUCTION';

    return () => {
      global.CONFIG_TYPE = originalConfigType;
    };
  },
};
