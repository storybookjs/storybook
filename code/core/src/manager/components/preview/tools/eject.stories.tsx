import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { EjectButton } from './eject';

const meta = {
  title: 'Tools/Eject',
  component: EjectButton,
  decorators: [
    (Story) => (
      <div style={{ padding: '1rem', display: 'inline-block' }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof EjectButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    storyId: 'example-story',
    baseUrl: 'http://localhost:6006/iframe.html',
    queryParams: {},
    storyFileName: 'src/stories/Example.stories.tsx',
  },
};

export const WithQueryParams: Story = {
  args: {
    storyId: 'example-story',
    baseUrl: 'http://localhost:6006/iframe.html',
    queryParams: {
      theme: 'dark',
      lang: 'en',
    },
    storyFileName: 'src/stories/Example.stories.tsx',
  },
};

export const CustomBaseUrl: Story = {
  args: {
    storyId: 'example-story',
    baseUrl: 'https://custom-storybook.example.com/iframe.html',
    queryParams: {},
    storyFileName: 'src/stories/Example.stories.tsx',
  },
};
