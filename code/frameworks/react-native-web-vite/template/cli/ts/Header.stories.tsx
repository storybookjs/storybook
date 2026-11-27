import preview from '../../.storybook/preview';

import { Header } from './Header';

const meta = preview.meta({
  title: 'Example/Header',
  component: Header,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ['autodocs'],
});

export const LoggedIn = meta.story({
  args: {
    user: {
      name: 'Jane Doe',
    },
    onLogin: () => {},
    onLogout: () => {},
    onCreateAccount: () => {},
  },
});

export const LoggedOut = meta.story({
  args: {
    onLogin: () => {},
    onLogout: () => {},
    onCreateAccount: () => {},
  },
});
