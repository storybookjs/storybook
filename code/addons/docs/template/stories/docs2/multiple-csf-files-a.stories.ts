import { global as globalThis } from '@storybook/global';

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

export const DefaultA = {};

export const SpanContent = {
  args: { content: '<span>span</span>' },
};

export const CodeContent = {
  args: { content: '<code>code</code>' },
};
