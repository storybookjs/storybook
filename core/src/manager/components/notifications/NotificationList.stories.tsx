import React from 'react';

import { LocationProvider } from '@storybook/core/router';
import type { Meta, StoryObj } from '@storybook/react';

import * as itemStories from './NotificationItem.stories';
import { NotificationList } from './NotificationList';

const meta = {
  component: NotificationList,
  title: 'Notifications/NotificationList',
  decorators: [
    (StoryFn) => (
      <LocationProvider>
        <StoryFn />
      </LocationProvider>
    ),

    (storyFn) => (
      <div style={{ width: '240px', margin: '1rem', position: 'relative', height: '100%' }}>
        {storyFn()}
      </div>
    ),
  ],
  excludeStories: /.*Data$/,
} satisfies Meta<typeof NotificationList>;

export default meta;
type Story = StoryObj<typeof meta>;

type ItemStories = typeof itemStories & { [key: string]: any };

const items = Array.from(Object.keys(itemStories as ItemStories))
  .filter((key) => !['default', '__namedExportsOrder'].includes(key))
  .map((key) => (itemStories as ItemStories)[key].args.notification);

export const Single: Story = {
  args: {
    notifications: [items[0]],
    clearNotification: () => {},
  },
};

export const Multiple: Story = {
  args: {
    notifications: items.slice(0, 3),
    clearNotification: () => {},
  },
};
