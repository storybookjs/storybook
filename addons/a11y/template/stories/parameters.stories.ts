import { global as globalThis } from '@storybook/global';

export default {
  component: globalThis.Components.Html,
  args: {
    content: '<button>Click Me!</button>',
  },
  parameters: {
    chromatic: { disable: true },
  },
};

export const Options = {
  args: {
    content:
      '<button style="color: rgb(255, 255, 255); background-color: rgb(76, 175, 80);">Click me!</button>',
  },
  parameters: {
    a11y: {
      config: {},
      options: {
        checks: {
          'color-contrast': { enabled: false },
        },
      },
    },
  },
};

export const Config = {
  args: {
    content:
      '<button style="color: rgb(255, 255, 255); background-color: rgb(76, 175, 80);">Click me!</button>',
  },
  parameters: {
    a11y: {
      config: {
        rules: [{ id: 'avoid-inline-spacing', options: {} }],
        disableOtherRules: true,
      },
      options: {},
    },
  },
};

export const Targetted = {
  args: {
    content: '<button class="custom-target">Click Me!</button>',
  },
  parameters: {
    a11y: {
      element: '.custom-target',
    },
  },
};

export const Disabled = {
  parameters: {
    a11y: {
      disable: true,
    },
  },
};
