import './tag-then-text';

// No meta docblock here, so the stories file can't change the component description.
export default {
  component: 'jsdoc-tag-then-text',
  tags: ['autodocs'],
  args: { label: 'jsdoc-tag-then-text' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
};

export const Default = {};
