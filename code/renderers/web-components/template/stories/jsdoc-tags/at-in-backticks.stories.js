import './at-in-backticks';

// No meta docblock here, so the stories file can't change the component description.
export default {
  component: 'jsdoc-at-in-backticks',
  tags: ['autodocs'],
  args: { label: 'jsdoc-at-in-backticks' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
};

export const Default = {};
