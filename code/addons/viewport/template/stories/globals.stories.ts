import { global as globalThis } from '@storybook/global';
import { MINIMAL_VIEWPORTS } from '@storybook/addon-viewport';

const first = Object.keys(MINIMAL_VIEWPORTS)[0];

export default {
  component: globalThis.Components.Pre,
  args: {
    text: 'Testing the viewport',
  },
  parameters: {
    chromatic: { disable: true },
  },
};

export const Unset = {
  globals: {},
};

export const Selected = {
  globals: {
    viewport: {
      value: first,
      isRotated: false,
    },
  },
};

export const Orientation = {
  globals: {
    viewport: {
      value: first,
      isRotated: true,
    },
  },
};

export const Invalid = {
  globals: {
    viewport: {
      value: 'phone',
      isRotated: false,
    },
  },
};

export const NoRationDefined = {
  globals: {
    viewport: {
      value: first,
    },
  },
};

export const Disabled = {
  parameters: {
    viewport: {
      disable: true,
    },
  },
};
