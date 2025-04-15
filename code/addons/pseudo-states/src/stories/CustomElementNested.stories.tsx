import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import './CustomElementNested';
import './grid.css';

const meta = {
  title: 'CustomElementNested',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  // @ts-expect-error We're dealing with a web component here
  render: (args, context) => <custom-element-nested>{context.name}</custom-element-nested>,
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const All: Story = {
  render: () => (
    <div className="story-grid">
      <div>
        {/* @ts-expect-error We're dealing with a web component here */}
        <custom-element-nested>Normal</custom-element-nested>
      </div>
      <div className="pseudo-hover-all">
        {/* @ts-expect-error We're dealing with a web component here */}
        <custom-element-nested>Hover</custom-element-nested>
      </div>
      <div className="pseudo-focus-all">
        {/* @ts-expect-error We're dealing with a web component here */}
        <custom-element-nested>Focus</custom-element-nested>
      </div>
      <div className="pseudo-active-all">
        {/* @ts-expect-error We're dealing with a web component here */}
        <custom-element-nested>Active</custom-element-nested>
      </div>
      <div className="pseudo-hover-all pseudo-focus-all">
        {/* @ts-expect-error We're dealing with a web component here */}
        <custom-element-nested>Hover Focus</custom-element-nested>
      </div>
      <div className="pseudo-hover-all pseudo-active-all">
        {/* @ts-expect-error We're dealing with a web component here */}
        <custom-element-nested>Hover Active</custom-element-nested>
      </div>
      <div className="pseudo-focus-all pseudo-active-all">
        {/* @ts-expect-error We're dealing with a web component here */}
        <custom-element-nested>Focus Active</custom-element-nested>
      </div>
      <div className="pseudo-hover-all pseudo-focus-all pseudo-active-all">
        {/* @ts-expect-error We're dealing with a web component here */}
        <custom-element-nested>Hover Focus Active</custom-element-nested>
      </div>
    </div>
  ),
};

export const Default: Story = {};

export const Hover: Story = {
  parameters: {
    pseudo: { hover: true },
  },
};

export const Focus: Story = {
  parameters: {
    pseudo: { focus: true },
  },
};

export const Active: Story = {
  parameters: {
    pseudo: { active: true },
  },
};
