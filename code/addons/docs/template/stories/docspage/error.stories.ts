export default {
  component: globalThis.Components.Button,
  tags: ['autodocs', '!test', '!vitest'],
  args: { label: 'Click Me!' },
  parameters: { chromatic: { disable: true } },
};

/** A story that throws */
export const ErrorStory = {
  decorators: [
    () => {
      throw new Error('Story did something wrong');
    },
  ],
};
