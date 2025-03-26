import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';

import { UpgradeBlock } from './UpgradeBlock';

const meta = {
  component: UpgradeBlock,
  title: 'UpgradeBlock',
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider
        value={
          {
            api: {
              getCurrentVersion: () => ({
                version: '7.2.2-alpha.0',
              }),
            },
          } as any
        }
      >
        {storyFn()}
      </ManagerContext.Provider>
    ),
  ],
  args: { onNavigateToWhatsNew: fn() },
} satisfies Meta<typeof UpgradeBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
