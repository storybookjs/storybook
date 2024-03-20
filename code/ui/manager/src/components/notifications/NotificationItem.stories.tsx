import React from 'react';
import { LocationProvider } from '@storybook/router';
import type { Meta, StoryObj } from '@storybook/react';
import NotificationItem from './NotificationItem';
import {
  AccessibilityIcon as AccessibilityIconIcon,
  BookIcon as BookIconIcon,
  FaceHappyIcon,
} from '@storybook/icons';

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
} satisfies Meta<typeof NotificationItem>;

export default meta;
type Story = StoryObj<typeof meta>;

const onClear = () => {};
const onDismissNotification = () => {};

export const Simple: Story = {
  args: {
    notification: {
      id: '1',
      onClear,
      content: {
        headline: 'Storybook cool!',
      },
      link: '/some/path',
    },
    onDismissNotification,
  },
};

export const LongHeadline: Story = {
  args: {
    ...Simple.args,
    notification: {
      id: '2',
      onClear,
      content: {
        headline: 'This is a long message that extends over two lines!',
      },
      link: '/some/path',
    },
  },
};

export const Link: Story = {
  args: {
    ...Simple.args,
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
    ...Simple.args,
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
    ...Simple.args,
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
    ...Simple.args,
    notification: {
      id: '6',
      onClear,
      content: {
        headline: 'Storybook has a book icon!',
      },
      icon: <BookIconIcon />,
      link: '/some/path',
    },
  },
};

export const StrongSubHeadline: Story = {
  args: {
    ...Simple.args,
    notification: {
      id: '7',
      onClear,
      content: {
        headline: 'Storybook has a book icon!',
        subHeadline: <strong>Strong subHeadline</strong>,
      },
      icon: <BookIconIcon />,
      link: '/some/path',
    },
  },
};

export const StrongEmphasizedSubHeadline: Story = {
  args: {
    ...Simple.args,
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
      link: '/some/path',
    },
  },
};

export const BookIconSubHeadline: Story = {
  args: {
    ...Simple.args,
    notification: {
      id: '9',
      onClear,
      content: {
        headline: 'Storybook has a book icon!',
        subHeadline: 'Find out more!',
      },
      icon: <BookIconIcon />,
      link: '/some/path',
    },
  },
};

export const BookIconLongSubHeadline: Story = {
  args: {
    ...Simple.args,
    notification: {
      id: '10',
      onClear,
      content: {
        headline: 'Storybook has a book icon!',
        subHeadline:
          'Find out more! by clicking on on buttons and downloading some applications. Find out more! by clicking on buttons and downloading some applications',
      },
      icon: <BookIconIcon />,
      link: '/some/path',
    },
  },
};

export const AccessibilityIcon: Story = {
  args: {
    ...Simple.args,
    notification: {
      id: '11',
      onClear,
      content: {
        headline: 'Storybook has a accessibility icon!',
        subHeadline: 'It is here!',
      },
      icon: <AccessibilityIconIcon />,
      link: '/some/path',
    },
  },
};

export const AccessibilityGoldIcon: Story = {
  args: {
    ...Simple.args,
    notification: {
      id: '12',
      onClear,
      content: {
        headline: 'Accessibility icon!',
        subHeadline: 'It is gold!',
      },
      icon: <AccessibilityIconIcon color="gold" />,
      link: '/some/path',
    },
  },
};

export const AccessibilityGoldIconLongHeadLineNoSubHeadline: Story = {
  args: {
    ...Simple.args,
    notification: {
      id: '13',
      onClear,
      content: {
        headline: 'Storybook notifications has a accessibility icon it can be any color!',
      },
      icon: <AccessibilityIconIcon color="gold" />,
      link: '/some/path',
    },
  },
};

export const WithOldIconFormat: Story = {
  args: {
    ...Simple.args,
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
      link: '/some/path',
    },
  },
};
