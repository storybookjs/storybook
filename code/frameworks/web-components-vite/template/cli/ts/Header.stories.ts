import preview from '../../.storybook/preview';

import { fn } from 'storybook/test';

import type { HeaderProps } from './Header';
import { Header } from './Header';

const meta = preview.type<{ args: HeaderProps }>().meta({
  title: 'Example/Header',
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ['autodocs'],
  render: (args: HeaderProps) => Header(args),
  args: {
    onLogin: fn(),
    onLogout: fn(),
    onCreateAccount: fn(),
  },
});

export const LoggedIn = meta.story({
  args: {
    user: {
      name: 'Jane Doe',
    },
  },
});

export const LoggedOut = meta.story({
  args: {},
});
