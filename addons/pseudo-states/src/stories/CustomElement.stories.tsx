import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import './CustomElement';
import './grid.css';

const meta = {
  title: 'CustomElement',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  // @ts-expect-error We're dealing with a web component here
  render: (args, context) => <custom-element>{context.name}</custom-element>,
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const All: Story = {
  render: () => (
    <div className="story-grid">
      <div>
        {/* @ts-expect-error We're dealing with a web component here */}
        <custom-element>Normal</custom-element>
      </div>
      <div className="pseudo-hover-all">
        {/* @ts-expect-error We're dealing with a web component here */}
        <custom-element>Hover</custom-element>
      </div>
      <div className="pseudo-focus-all">
        {/* @ts-expect-error We're dealing with a web component here */}
        <custom-element>Focus</custom-element>
      </div>
      <div className="pseudo-active-all">
        {/* @ts-expect-error We're dealing with a web component here */}
        <custom-element>Active</custom-element>
      </div>
      <div className="pseudo-hover-all pseudo-focus-all">
        {/* @ts-expect-error We're dealing with a web component here */}
        <custom-element>Hover Focus</custom-element>
      </div>
      <div className="pseudo-hover-all pseudo-active-all">
        {/* @ts-expect-error We're dealing with a web component here */}
        <custom-element>Hover Active</custom-element>
      </div>
      <div className="pseudo-focus-all pseudo-active-all">
        {/* @ts-expect-error We're dealing with a web component here */}
        <custom-element>Focus Active</custom-element>
      </div>
      <div className="pseudo-hover-all pseudo-focus-all pseudo-active-all">
        {/* @ts-expect-error We're dealing with a web component here */}
        <custom-element>Hover Focus Active</custom-element>
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
