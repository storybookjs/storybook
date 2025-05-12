export default {
  component: globalThis.Components.Button,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disable: true },
    // Select all the headings in the document
    docs: { toc: { headingSelector: 'h1, h2, h3' } },
  },
};

export const One = { args: { label: 'One' } };
export const Two = { args: { label: 'Two' } };
export const Three = { args: { label: 'Three' } };
