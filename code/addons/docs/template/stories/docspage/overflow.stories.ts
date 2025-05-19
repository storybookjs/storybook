export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  tags: ['autodocs'],
  args: {
    text: 'Demonstrates overflow',
    style: { width: 2000, height: 500, background: 'hotpink' },
  },
  parameters: { chromatic: { disable: true } },
};

export const Basic = {};
