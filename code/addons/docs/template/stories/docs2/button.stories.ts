export default {
  component: globalThis.Components.Button,
  tags: ['autodocs'],
  args: { onClick: () => console.log('clicked!') },
  parameters: {
    chromatic: { disable: true },
  },
};

export const Basic = {
  args: { label: 'Basic' },
};

export const One = {
  args: { label: 'One' },
};

export const Two = {
  args: { label: 'Two' },
};
