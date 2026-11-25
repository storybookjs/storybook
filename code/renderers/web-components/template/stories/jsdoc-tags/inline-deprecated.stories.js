import './inline-deprecated';

// No meta docblock here, so the stories file can't change the component description.
export default {
  component: 'jsdoc-inline-deprecated',
  tags: ['autodocs'],
  args: { label: 'jsdoc-inline-deprecated' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
};

export const Default = {};
