export default {
  title: 'Multiple CSF Files Same Title',
  component: globalThis.__TEMPLATE_COMPONENTS__.Html,
  tags: ['autodocs'],
  args: {
    content: '<p>paragraph</p>',
  },
  parameters: {
    chromatic: { disable: true },
  },
};

export const DefaultA = {};

export const SpanContent = {
  args: { content: '<span>span</span>' },
};

export const CodeContent = {
  args: { content: '<code>code</code>' },
};
