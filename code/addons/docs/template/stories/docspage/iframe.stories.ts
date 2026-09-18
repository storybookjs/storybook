export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  tags: ['autodocs'],
  args: { label: 'Rendered in iframe' },
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: {
      story: {
        iframeHeight: '120px',
        inline: true,
      },
    },
  },
};

export const Basic = {};
