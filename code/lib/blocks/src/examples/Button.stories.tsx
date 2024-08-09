/* eslint-disable local-rules/no-uncategorized-errors */
import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, within } from '@storybook/test';

import { Button } from './Button';

const meta = {
  title: 'examples/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  // Stop *this* story from being stacked in Chromatic
  globals: { sb_theme: 'default' },
  parameters: {
    // these are to test the deprecated features of the Description block
    notes: 'These are notes for the Button stories',
    info: 'This is info for the Button stories',
    jsx: { useBooleanShorthandSyntax: false },
    docs: {
      subtitle: 'This is the subtitle for the Button stories',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * This is the primary mode for the button
 *
 * _this description was written as a comment above the story_
 */
export const Primary: Story = {
  args: {
    primary: true,
    label: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    label: 'Button',
  },
  parameters: {
    docs: {
      description: {
        story: `
This is the secondary - or default - mode for the button

_this description was written as a string in \`parameters.docs.description.story\`_`,
      },
    },
  },
};

/**
 * This is the large button
 * _this description was written as a comment above the story, and should never be shown because it should be overridden by the description in the parameters_
 */
export const Large: Story = {
  args: {
    size: 'large',
    label: 'Button',
  },
  parameters: {
    docs: {
      description: {
        story: `
This is the large button

_this description was written as a string in \`parameters.docs.description.story\`, and overrides the comment above the story_
`,
      },
    },
  },
};

export const Small: Story = {
  args: {
    size: 'small',
    label: 'Button',
  },
};

export const Clicking: Story = {
  args: {
    primary: true,
    label: 'Increment',
  },
  render: (args) => {
    const [count, setCount] = React.useState(0);
    return (
      <>
        <Button {...args} onClick={() => setCount(count + 1)} />
        <div style={{ padding: '1rem' }}>Click count: {count}</div>
      </>
    );
  },
  play: async ({ canvasElement, id }) => {
    const canvas = within(canvasElement);

    const button = canvas.getByText('Increment');
    await fireEvent.click(button);

    expect(canvas.getByText('Click count: 1')).toBeInTheDocument();
  },
};

export const ClickingInDocs: Story = {
  ...Clicking,
  parameters: { docs: { story: { autoplay: true } } },
};

export const ErrorStory: Story = {
  render: () => {
    const err = new Error('Rendering problem');
    // force stack for consistency in capture
    err.stack = `
      at undecoratedStoryFn (/sb-preview/file.js:000:0001)
      at hookified (/sb-preview/file.js:000:0001)
      at defaultDecorateStory (/sb-preview/file.js:000:0001)
      at jsxDecorator (/assets/file.js:000:0001)
      at hookified (/sb-preview/file.js:000:0001)
      at decorateStory (/sb-preview/file.js:000:0001)
      at renderWithHooks (/sb-preview/file.js:000:0001)
      at mountIndeterminateComponent (/assets/file.js:000:0001)
      at beginWork (/assets/file.js:000:0001)
      at longMockedPath (/node_modules/.cache/storybook/da6a511058d185c3c92ed7790fc88078d8a947a8d0ac75815e8fd5704bcd4baa/sb-vite/deps/file.js?v=00000000:000:0001)
    `;
    throw err;
  },
  args: { label: 'Button' },
  parameters: {
    chromatic: { disable: true },
  },
};
