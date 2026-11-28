import './tagged-button';

// No meta docblock here, so the stories file can't change the component description.
export default {
  component: 'jsdoc-tagged-button',
  tags: ['autodocs'],
  args: { label: 'jsdoc-tagged-button' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
};

export const Default = {};
