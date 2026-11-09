export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  tags: ['autodocs'],
  args: {
    text: 'Demonstrates overflow',
    style: { width: '2000px', height: '500px', background: 'hotpink' },
  },
  parameters: { chromatic: { disableSnapshot: true } },
};

export const Basic = {};
