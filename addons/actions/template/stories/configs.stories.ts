import { global as globalThis } from '@storybook/global';

import { actions, configureActions } from '@storybook/addon-actions';

const configs = actions('actionA', 'actionB', 'actionC');

export default {
  component: globalThis.Components.Button,
  args: {
    label: 'Click Me!',
  },
  parameters: {
    chromatic: { disable: true },
  },
};

export const ActionA = {
  args: { onClick: configs.actionA },
};
export const ActionB = {
  args: { onClick: configs.actionB },
};
export const ActionC = {
  args: { onClick: configs.actionC },
};

export const ConfigureActions = {
  args: { onClick: configs.actionA },
  decorators: [
    (storyFn: any) => {
      configureActions({ depth: 2 });

      return storyFn();
    },
  ],
};
