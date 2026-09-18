export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  subcomponents: {
    Pre: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  },
  tags: ['autodocs'],
  args: { label: 'Click Me!' },
  parameters: {
    docs: {
      description: {
        component: '**Component** description',
      },
    },
    chromatic: { disableSnapshot: true },
  },
};

export const Basic = {};

export const CustomDescription = {
  parameters: {
    docs: {
      description: {
        story: '**Story** description',
      },
    },
  },
};
