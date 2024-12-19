export default {
  component: globalThis.Components.Button,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disable: true },
    docs: {
      codePanel: false,
    },
  },
};

export const One = { args: { label: 'One' } };

export const Two = { args: { label: 'Two' } };

export const WithSource = {
  args: { label: 'Three' },
  parameters: {
    docs: {
      codePanel: true,
    },
  },
};
