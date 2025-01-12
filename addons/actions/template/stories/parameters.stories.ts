import { global as globalThis } from '@storybook/global';

import { withActions } from '@storybook/addon-actions/decorator';

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
    handles: [{ click: 'clicked', contextmenu: 'right clicked' }],
  },
  decorators: [withActions],
};
