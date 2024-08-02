import React from 'react';

const badOutput = { renderable: 'no, react can not render objects' };
const BadComponent = () => badOutput;

export default {
  component: BadComponent,
  parameters: {
    chromatic: { disable: true },
  },
  tags: ['!test'],
};

export const RenderThrows = {
  render() {
    throw new Error('storyFn threw an error! WHOOPS');
  },
};

export const ComponentIsUnrenderable = {};

export const StoryIsUnrenderable = {
  render: () => badOutput,
};

export const StoryContainsUnrenderable = {
  render: () => (
    <div>
      {/* @ts-expect-error we're doing it wrong here on purpose */}
      <BadComponent />
    </div>
  ),
};
