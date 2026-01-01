/* eslint-disable local-rules/no-uncategorized-errors */
export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  tags: ['autodocs', '!test', '!vitest'],
  args: { label: 'Click Me!' },
  parameters: { chromatic: { disableSnapshot: true } },
};

/** A story that throws */
export const ErrorStory = {
  decorators: [
    () => {
      const err = new Error('Story did something wrong');
      err.stack = `
        at errorStory (/sb-preview/file.js:000:0001)
        at hookified (/sb-preview/file.js:000:0001)
        at defaultDecorateStory (/sb-preview/file.js:000:0001)
        at jsxDecorator (/assets/file.js:000:0001)
        at hookified (/sb-preview/file.js:000:0001)
        at decorateStory (/sb-preview/file.js:000:0001)
      `;
      throw err;
    },
  ],
};
