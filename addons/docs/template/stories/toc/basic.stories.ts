export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disable: true },
    docs: { toc: {} },
  },
};

export const One = { args: { label: 'One' } };
export const Two = { args: { label: 'Two' } };
export const Three = { args: { label: 'Three' } };
