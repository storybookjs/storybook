export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: {
      codePanel: true,
    },
  },
};

/** Default story for the Code panel demo and story-docs e2e (`code/e2e-internal/story-docs.spec.ts`). */
export const Default = {
  args: { label: 'e2eStoryDocsBefore' },
  parameters: {
    docs: {
      canvas: {
        sourceState: 'shown',
      },
    },
  },
};

export const CustomCode = {
  args: { label: 'Custom code' },
  parameters: {
    docs: {
      source: {
        code: '<button>Custom code</button>',
      },
    },
  },
};

export const WithoutPanel = {
  args: { label: 'Without panel' },
  parameters: {
    docs: {
      codePanel: false,
    },
  },
};
