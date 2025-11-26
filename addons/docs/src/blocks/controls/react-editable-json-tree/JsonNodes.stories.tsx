import React from 'react';

const meta = {
  title: 'Controls/JsonNodes',
  tags: ['autodocs'],
  argTypes: {
    value: { control: { type: 'object' } },
    function: { control: { type: 'object' } },
  },
  args: {
    value: { any: 'value' },
    function: { value: () => {} },
  },
  parameters: {
    // This story exists only to verify proper behavior on its docs page, the snapshot is irrelevant
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

export const JsonNodes = {
  render: () => (
    <a href="https://www.google.com/" target="_blank" rel="noreferrer">
      Confirm the link works by pressing enter key
    </a>
  ),
};
