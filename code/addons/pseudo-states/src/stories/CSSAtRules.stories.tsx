import React, { type ComponentProps } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './CSSAtRules';
import './grid.css';

const meta = {
  title: 'CSSAtRules',
  component: Button,
  render: (args, context) => <Button {...args}>{context.name}</Button>,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const All: Story = {
  render: (args: ComponentProps<typeof Button>) => (
    <div className="story-grid">
      <div>
        <Button {...args}>Normal</Button>
      </div>
      <div className="pseudo-hover-all">
        <Button {...args}>Hover</Button>
      </div>
      <div className="pseudo-focus-all">
        <Button {...args}>Focus</Button>
      </div>
      <div className="pseudo-active-all">
        <Button {...args}>Active</Button>
      </div>
      <div className="pseudo-hover-all pseudo-focus-all">
        <Button {...args}>Hover Focus</Button>
      </div>
      <div className="pseudo-hover-all pseudo-active-all">
        <Button {...args}>Hover Active</Button>
      </div>
      <div className="pseudo-focus-all pseudo-active-all">
        <Button {...args}>Focus Active</Button>
      </div>
      <div className="pseudo-hover-all pseudo-focus-all pseudo-active-all">
        <Button {...args}>Hover Focus Active</Button>
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

export const DynamicStyles: Story = {
  render: (args, context) => {
    return All.render!({ className: 'dynamic' }, context);
  },
  play: async ({ id: storyId }) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // @ts-expect-error We're adding this nonstandard property below
        if (globalThis[`__dynamicRuleInjected_${storyId}`]) {
          return;
        }
        // @ts-expect-error We're adding this nonstandard property
        globalThis[`__dynamicRuleInjected_${storyId}`] = true;
        const sheet = Array.from(document.styleSheets).at(-1);
        sheet?.insertRule(
          '@layer foo { .dynamic.button:hover { background-color: tomato!important } }'
        );
        resolve();
      }, 100);
    });
  },
};
