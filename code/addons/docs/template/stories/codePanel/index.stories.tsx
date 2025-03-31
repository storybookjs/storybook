export default {
  component: globalThis.Components.Button,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disable: true },
  },
};

export const Default = { args: { label: 'Default' } };

export const CustomCode = {
  args: { label: 'Custom code' },
  parameters: {
    docs: {
      source: {
        code: '<button>Custom code</button>',
      },
    },
  },
};
