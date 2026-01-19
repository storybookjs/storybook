export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  tags: ['autodocs'],
  args: { label: 'Click Me!' },
  parameters: {
    docs: {
      // FIXME: this is typically provided by the renderer preset to extract
      //   the description automatically based on docgen info. including here
      //   for documentation purposes only.
      extractComponentDescription: () => 'component description',
    },
    chromatic: { disableSnapshot: true },
  },
};

export const Basic = {};
