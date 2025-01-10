// WebContainerRunner.stories.tsx
import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { WebContainerRunner } from './WebContainerRunner';

const meta: Meta = {
  title: 'WebContainers/Runner',
  component: WebContainerRunner,
};

export default meta;

type Story = StoryObj<typeof WebContainerRunner>;

export const Basic: Story = {
  render: () => <WebContainerRunner />,
};
