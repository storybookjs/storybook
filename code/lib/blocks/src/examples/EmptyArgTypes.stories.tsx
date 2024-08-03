import type { Meta, StoryObj } from '@storybook/react';
import type { ControlsParameters } from './ControlsParameters';
import React from 'react';

const meta = {
  title: 'examples/Empty ArgTypes for Control blocks',
  // note that component is not specified, so no argtypes can be generated
  render: () => <div>I am a story without args or argTypes</div>,
  parameters: { chromatic: { disableSnapshot: true } },
} satisfies Meta<typeof ControlsParameters>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * There are no argTypes or args, so this story won't show any controls in the docs page.
 * In the control addon it will show a UI how to set up controls.
 */
export const Default: Story = {};
