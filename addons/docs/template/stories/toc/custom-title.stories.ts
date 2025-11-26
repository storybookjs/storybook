export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disable: true },
    // Custom title label
    docs: { toc: { title: 'Contents' } },
  },
};

export const One = { args: { label: 'One' } };
export const Two = { args: { label: 'Two' } };
export const Three = { args: { label: 'Three' } };
