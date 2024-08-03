import type { Meta, StoryObj } from '@storybook/react';
import { ManagerContext } from '@storybook/core/manager-api';
import React from 'react';
import { UpgradeBlock } from './UpgradeBlock';
import { fn } from '@storybook/test';

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
