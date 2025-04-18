import React, { type ComponentProps } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button';
import './grid.css';

const meta = {
  title: 'Button',
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

export const DirectSelector: Story = {
  render: () => (
    <>
      <div className="story-grid">
        <Button>Normal</Button>
        <Button data-hover>Hover</Button>
        <Button data-focus>Focus</Button>
        <Button data-active>Active</Button>
        <Button data-hover data-focus>
          Hover Focus
        </Button>
        <Button data-hover data-active>
          Hover Active
        </Button>
        <Button data-focus data-active>
          Focus Active
        </Button>
        <Button data-hover data-focus data-active>
          Hover Focus Active
        </Button>
      </div>
      <h3>Multiple hovered button grouped</h3>
      <div data-hover-group>
        <Button>Hovered 1</Button>
        <Button>Hovered 2</Button>
        <Button>Hovered 3</Button>
      </div>
    </>
  ),
  parameters: {
    pseudo: {
      hover: ['[data-hover]', '[data-hover-group] button'],
      focus: '[data-focus]',
      active: ['[data-active]'],
    },
  },
};

export const DirectSelectorParentDoesNotAffectDescendants: Story = {
  render: () => (
    <>
      <Button id="foo">Hovered 1</Button>

      <div id="foo">
        <Button>Not Hovered 1 </Button>
        <Button>Not Hovered 2</Button>
      </div>
    </>
  ),
  parameters: {
    pseudo: {
      hover: ['#foo'],
    },
  },
};

export const DynamicStyles: Story = {
  render: (args, context) => {
    return All.render!({ className: 'dynamic' }, context);
  },
  play: async ({ id: storyId }) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // @ts-expect-error We're adding this nonstandard property
        if (globalThis[`__dynamicRuleInjected_${storyId}`]) {
          return;
        }
        // @ts-expect-error We're adding this nonstandard property
        globalThis[`__dynamicRuleInjected_${storyId}`] = true;
        const sheet = Array.from(document.styleSheets).at(-1);
        sheet?.insertRule('.dynamic.button:hover { background-color: tomato }');
        resolve();
      }, 100);
    });
  },
};
