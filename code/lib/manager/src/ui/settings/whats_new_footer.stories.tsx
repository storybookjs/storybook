import type { Meta, StoryObj } from '@storybook/react-vite';

import { WhatsNewFooter } from './whats_new.tsx';

const meta = {
  component: WhatsNewFooter,
} satisfies Meta<typeof WhatsNewFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isNotificationsEnabled: false,
    copyContent: 'https://storybook.js.org/blog',
  },
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ur4kydUbRqdDyfoZWzdiIw/Storybook-app?type=design&node-id=9562-117308&mode=design&t=dJUhQrYPI3PCqPg2-4',
    },
  },
};
