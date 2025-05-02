import { global as globalThis } from '@storybook/global';

import { withActions } from 'storybook/actions/decorator';

export default {
  component: globalThis.Components.Button,
  args: {
    label: 'Click Me!',
  },
  parameters: {
    chromatic: { disable: true },
  },
};

export const Basic = {
  parameters: {
    actions: {
      handles: [{ click: 'clicked', contextmenu: 'right clicked' }],
    },
  },
  decorators: [withActions],
};
