import type { Meta, StoryObj } from '@storybook/ember';

import { fn } from 'storybook/test';

import Header, { type Signature } from './Header.gts';

const meta = {
  title: 'Example/Header',
  component: Header,
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: 'fullscreen',
  },
  args: {
    onLogin: fn(),
    onLogout: fn(),
    onCreateAccount: fn(),
  },
} satisfies Meta<Signature['Args']>;

export default meta;
type Story = StoryObj<Signature['Args']>;

export const LoggedIn: Story = {
  args: {
    user: {
      name: 'Jane Doe',
    },
  },
};

export const LoggedOut: Story = {};
