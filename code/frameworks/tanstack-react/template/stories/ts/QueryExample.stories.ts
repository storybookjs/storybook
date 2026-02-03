import type { Meta, StoryObj } from '@storybook/react';

import { QueryExample } from './QueryExample';

const meta: Meta<typeof QueryExample> = {
  component: QueryExample,
  parameters: {
    tanstack: {
      queryClientConfig: {
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
          },
        },
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof QueryExample>;

export const Default: Story = {};
