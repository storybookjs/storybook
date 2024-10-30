import React, { useEffect } from 'react';

import type { Meta, StoryObj } from '@storybook/react';
import { within } from '@storybook/test';

import { ManagerContext } from '@storybook/core/manager-api';

import { LayoutProvider, useLayout } from '../../layout/LayoutProvider';
import { MobileAbout } from './MobileAbout';

/** A helper component to open the about page via the MobileLayoutContext */
const OpenAboutHelper = ({ children }: { children: any }) => {
  const { setMobileAboutOpen } = useLayout();
  useEffect(() => {
    setMobileAboutOpen(true);
  }, [setMobileAboutOpen]);
  return children;
};

const meta = {
  component: MobileAbout,
  title: 'Mobile/About',
  globals: { sb_theme: 'light' },
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'mobile1',
    },
    chromatic: { viewports: [320] },
  },
  decorators: [
    (storyFn) => {
      return (
        <ManagerContext.Provider
          value={
            {
              api: {
                getCurrentVersion: () => ({
                  version: '7.2.0',
                }),
              },
            } as any
          }
        >
          <LayoutProvider>
            <OpenAboutHelper>{storyFn()}</OpenAboutHelper>
          </LayoutProvider>
        </ManagerContext.Provider>
      );
    },
  ],
} satisfies Meta<typeof MobileAbout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = {
  globals: { sb_theme: 'dark' },
};

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const closeButton = await within(canvasElement).getByTitle('Close about section');
    await closeButton.click();
  },
};
