import React, { useEffect } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { within } from 'storybook/test';

import { LayoutProvider, useLayout } from '../../layout/LayoutProvider';
import { MobileA11yStatement } from './MobileA11yStatement';

/** A helper component to open the about page via the MobileLayoutContext */
const OpenAboutHelper = ({ children }: { children: any }) => {
  const { setMobileA11yStatementOpen } = useLayout();
  useEffect(() => {
    setMobileA11yStatementOpen(true);
  }, [setMobileA11yStatementOpen]);
  return children;
};

const meta = {
  component: MobileA11yStatement,
  title: 'Mobile/AccessibilityStatement',
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
} satisfies Meta<typeof MobileA11yStatement>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = {
  globals: { sb_theme: 'dark' },
};

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const closeButton = within(canvasElement).getByText('Back');
    closeButton.click();
  },
};
