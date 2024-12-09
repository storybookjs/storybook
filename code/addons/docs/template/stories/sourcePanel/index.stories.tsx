export default {
  component: globalThis.Components.Button,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disable: true },
    docsSourcePanel: { disable: true },
  },
};

export const One = { args: { label: 'One' } };
export const Two = { args: { label: 'Two' } };
export const WithSource = {
  args: { label: 'Three' },
  parameters: { docsSourcePanel: { disable: false } },
};
