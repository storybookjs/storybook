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
};

export default meta;

export const JsonNodes = () => {
  return (
    <a href="https://www.google.com/" target="_blank" rel="noreferrer">
      Confirm the link works by pressing enter key
    </a>
  );
};
