export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
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
