export default {
  component: globalThis.Components.Button,
  tags: ['autodocs'],
  args: { label: 'Click Me!' },
  parameters: {
    docs: {
      // FIXME: this is typically provided by the renderer preset to extract
      //   the description automatically based on docgen info. including here
      //   for documentation purposes only.
      extractComponentDescription: () => 'component description',
    },
    chromatic: { disable: true },
  },
};

export const Basic = {};
