import React, { type FC } from 'react';

const Component: FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div>{children}</div>;
};

export default {
  component: Component,
  tags: ['autodocs'],
};

// This story is used to test whether JSX elements render correctly in autodocs and controls panel
export const Default = {
  args: {
    children: <div>Test</div>,
  },
};

// React.ReactNode props default to the text control; a plain string arg is editable and
// round-trips through the URL args (#11429)
export const NodeValue = {
  args: {
    children: 'Node prop edited with the text control',
  },
};
