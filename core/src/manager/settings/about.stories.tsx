import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import UpgradeBlockStoriesMeta from '../components/upgrade/UpgradeBlock.stories';
import { AboutScreen } from './About';

const meta = {
  component: AboutScreen,
  title: 'Settings/AboutScreen',
  decorators: [
    UpgradeBlockStoriesMeta.decorators[0],
    (Story) => (
      <div
        style={{
          position: 'relative',
          height: '100vh',
          width: '100vw',
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: { onNavigateToWhatsNew: fn() },
} satisfies Meta<typeof AboutScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ur4kydUbRqdDyfoZWzdiIw/Storybook-app?type=design&node-id=9564-120444&mode=design&t=0TPINZFpwgFQFQeX-4',
    },
  },
};
