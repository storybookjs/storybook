import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ShadowRoot } from './ShadowRoot';
import './grid.css';

const meta = {
  title: 'ShadowRoot',
  component: ShadowRoot,
} satisfies Meta<typeof ShadowRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const All: Story = {
  render: () => (
    <div className="story-grid">
      <div>
        <ShadowRoot label="Normal" />
      </div>
      <div className="pseudo-hover-all">
        <ShadowRoot label="Hover" />
      </div>
      <div className="pseudo-focus-all">
        <ShadowRoot label="Focus" />
      </div>
      <div className="pseudo-active-all">
        <ShadowRoot label="Active" />
      </div>
      <div className="pseudo-hover-all pseudo-focus-all">
        <ShadowRoot label="Hover Focus" />
      </div>
      <div className="pseudo-hover-all pseudo-active-all">
        <ShadowRoot label="Hover Active" />
      </div>
      <div className="pseudo-focus-all pseudo-active-all">
        <ShadowRoot label="Focus Active" />
      </div>
      <div className="pseudo-hover-all pseudo-focus-all pseudo-active-all">
        <ShadowRoot label="Hover Focus Active" />
      </div>
    </div>
  ),
};

export const Default: Story = {};

export const Hover: Story = {
  parameters: {
    pseudo: {
      hover: true,
    },
  },
};

export const Focus: Story = {
  parameters: {
    pseudo: {
      focus: true,
    },
  },
};

export const Active: Story = {
  parameters: {
    pseudo: {
      active: true,
    },
  },
};
