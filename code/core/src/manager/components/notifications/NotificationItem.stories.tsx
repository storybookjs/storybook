import React from 'react';

import { LocationProvider } from '@storybook/core/router';
import {
  AccessibilityIcon as AccessibilityIconIcon,
  BookIcon as BookIconIcon,
  FaceHappyIcon,
} from '@storybook/icons';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from '@storybook/test';

import { action } from '@storybook/addon-actions';

import NotificationItem from './NotificationItem';

const meta = {
  component: NotificationItem,
  title: 'Notifications/NotificationItem',
  decorators: [
    (Story) => (
      <LocationProvider>
        <Story />
      </LocationProvider>
    ),
    (Story) => (
      <div style={{ width: '240px', margin: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  excludeStories: /.*Data$/,
  args: {
    onDismissNotification: () => {},
  },
} satisfies Meta<typeof NotificationItem>;

export default meta;
type Story = StoryObj<typeof meta>;

const onClear = fn(action('onClear'));
const onClick = fn(action('onClick'));

export const Simple: Story = {
  args: {
    notification: {
      id: '1',
      onClear,
      content: {
        headline: 'Storybook cool!',
      },
    },
  },
};

export const Timeout: Story = {
  args: {
    notification: {
      id: 'Timeout',
      onClear,
      onClick,
      content: {
        headline: 'Storybook cool!',
      },
      duration: 3000,
    },
  },
  play: async ({ args }) => {
    await waitFor(
      () => {
        expect(args.notification.onClear).toHaveBeenCalledWith({ dismissed: false, timeout: true });
      },
      {
        timeout: 4000,
      }
    );
  },
};

export const LongHeadline: Story = {
  args: {
    notification: {
      id: '2',
      onClear,
      content: {
        headline: 'This is a long message that extends over two lines!',
      },
      link: undefined,
    },
  },
};

export const Clickable: Story = {
  args: {
    notification: {
      id: 'Clickable',
      onClear,
      onClick,
      content: {
        headline: 'Storybook cool!',
      },
    },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const notification = await canvas.findByText('Storybook cool!');
    await userEvent.click(notification);
    await expect(args.notification.onClick).toHaveBeenCalledWith({ onDismiss: expect.anything() });
  },
};

export const Link: Story = {
  args: {
    notification: {
      id: '3',
      onClear,
      content: {
        headline: 'Storybook X.X is available! Download now »',
      },
      link: '/some/path',
    },
  },
};

export const LinkIconWithColor: Story = {
  args: {
    notification: {
      id: '4',
      onClear,
      content: {
        headline: 'Storybook with a smile!',
      },
      icon: <FaceHappyIcon color="hotpink" />,
      link: '/some/path',
    },
  },
};

export const LinkIconWithColorSubHeadline: Story = {
  args: {
    notification: {
      id: '5',
      onClear,
      content: {
        headline: 'Storybook X.X is available with a smile! Download now »',
        subHeadline: 'This link also has a sub headline',
      },
      icon: <FaceHappyIcon color="tomato" />,
      link: '/some/path',
    },
  },
};

export const BookIcon: Story = {
  args: {
    notification: {
      id: '6',
      onClear,
      content: {
        headline: 'Storybook has a book icon!',
      },
      icon: <BookIconIcon />,
      link: undefined,
    },
  },
};

export const StrongSubHeadline: Story = {
  args: {
    notification: {
      id: '7',
      onClear,
      content: {
        headline: 'Storybook has a book icon!',
        subHeadline: <strong>Strong subHeadline</strong>,
      },
      icon: <BookIconIcon />,
      link: undefined,
    },
  },
};

export const StrongEmphasizedSubHeadline: Story = {
  args: {
    notification: {
      id: '8',
      onClear,
      content: {
        headline: 'Storybook cool!',
        subHeadline: (
          <span>
            <em>Emphasized</em> normal <strong>strong Storybook!</strong>
          </span>
        ),
      },
      icon: <BookIconIcon />,
      link: undefined,
    },
  },
};

export const BookIconSubHeadline: Story = {
  args: {
    notification: {
      id: '9',
      onClear,
      content: {
        headline: 'Storybook has a book icon!',
        subHeadline: 'Find out more!',
      },
      icon: <BookIconIcon />,
      link: undefined,
    },
  },
};

export const BookIconLongSubHeadline: Story = {
  args: {
    notification: {
      id: '10',
      onClear,
      content: {
        headline: 'Storybook has a book icon!',
        subHeadline:
          'Find out more! by clicking on buttons and downloading some applications. Find out more! by clicking on buttons and downloading some applications',
      },
      icon: <BookIconIcon />,
      link: undefined,
    },
  },
};

export const AccessibilityIcon: Story = {
  args: {
    notification: {
      id: '11',
      onClear,
      content: {
        headline: 'Storybook has a accessibility icon!',
        subHeadline: 'It is here!',
      },
      icon: <AccessibilityIconIcon />,
      link: undefined,
    },
  },
};

export const AccessibilityGoldIcon: Story = {
  args: {
    notification: {
      id: '12',
      onClear,
      content: {
        headline: 'Accessibility icon!',
        subHeadline: 'It is gold!',
      },
      icon: <AccessibilityIconIcon color="gold" />,
      link: undefined,
    },
  },
};

export const AccessibilityGoldIconLongHeadLineNoSubHeadline: Story = {
  args: {
    notification: {
      id: '13',
      onClear,
      content: {
        headline: 'Storybook notifications has a accessibility icon it can be any color!',
      },
      icon: <AccessibilityIconIcon color="gold" />,
      link: undefined,
    },
  },
};

export const WithOldIconFormat: Story = {
  args: {
    notification: {
      id: '13',
      onClear,
      content: {
        headline: 'Storybook notifications has a accessibility icon it can be any color!',
      },
      icon: {
        name: 'accessibility',
        color: 'gold',
      },
      link: undefined,
    },
  },
};
