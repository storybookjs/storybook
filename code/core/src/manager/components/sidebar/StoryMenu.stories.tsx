import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';
import { fn, userEvent } from '@storybook/test';

import { ManagerContext } from '@storybook/core/manager-api';

import { StoryMenu } from './StoryMenu';

const managerContext: any = {
  api: {
    emit: fn().mockName('api::emit'),
    on: fn().mockName('api::on'),
    off: fn().mockName('api::off'),
  },
};

const meta = {
  component: StoryMenu,
  args: {
    storyId: 'story-id',
    isSelected: false,
    onSelectStoryId: () => {},
    actions: {
      addonA: {
        title: 'Run component tests',
        description: 'Run component tests for this story',
        event: 'COMPONENT_TESTS_RUN',
      },
      addonB: {
        title: 'Run accessibility tests',
        event: 'A11Y_TESTS_RUN',
      },
    },
    status: {
      addonA: {
        title: 'Accessibility violations',
        status: 'error',
        count: 3,
      },
      addonB: {
        title: 'Visual changes',
        status: 'warn',
      },
    },
    statusIcon: null,
    statusValue: 'unknown',
  },
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => <ManagerContext.Provider value={managerContext}>{Story()}</ManagerContext.Provider>,
    (Story) => (
      <div style={{ '--story-menu-visibility': 'visible', height: 220, width: 250 } as any}>
        {Story()}
      </div>
    ),
  ],
} satisfies Meta<typeof StoryMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) =>
    userEvent.click(await canvas.findByRole('button', { name: 'Story menu' })),
};
