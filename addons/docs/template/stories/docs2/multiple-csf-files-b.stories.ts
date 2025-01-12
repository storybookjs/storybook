export default {
  title: 'Multiple CSF Files Same Title',
  component: globalThis.Components.Html,
  tags: ['autodocs'],
  args: {
    content: '<p>paragraph</p>',
  },
  parameters: {
    chromatic: { disable: true },
  },
};

export const DefaultB = {};

export const H1Content = {
  args: { content: '<h1>heading 1</h1>' },
};

export const H2Content = {
  args: { content: '<h2>heading 2</h2>' },
};
