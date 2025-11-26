import React from 'react';

export default {
  component: {},
  parameters: {
    chromatic: { disable: true },
  },
};

const Template = ({ label }: { label: string }) => <div>{label}</div>;
Template.args = { label: 'Hello' };

export const Hello1 = Template.bind({});

export const Hello2 = Template.bind({});

export const Hello3 = Template.bind({});
