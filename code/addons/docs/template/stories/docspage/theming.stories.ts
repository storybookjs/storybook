import { create } from 'storybook/internal/theming';

import { global as globalThis } from '@storybook/global';
import { fn } from '@storybook/test';

export default {
  component: globalThis.Components.Button,
  tags: ['autodocs'],
  args: { label: 'Click Me!', onClick: fn() },
  parameters: { chromatic: { disable: true } },
};

// Using strings not supported by Polished should not crash
// https://github.com/storybookjs/storybook/issues/28781
// https://github.com/storybookjs/storybook/discussions/25092#discussioncomment-10533731
export const Customization = {
  parameters: {
    docs: {
      theme: create({
        base: 'dark',
        appContentBg: 'var(--unset-css-var, #225)',
        textColor: 'var(--another-unset-var, tomato)',
      }),
    },
  },
};
