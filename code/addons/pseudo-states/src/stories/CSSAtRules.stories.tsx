import React, { type ComponentProps } from 'react';

import { FORCE_REMOUNT } from 'storybook/internal/core-events';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { useChannel, useStoryContext } from 'storybook/preview-api';

import { Button } from './CSSAtRules.tsx';
import './grid.css';
import { PseudoStateGrid } from './PseudoStateGrid.tsx';

const meta = {
  title: 'CSSAtRules',
  component: Button,
  render: (args, context) => <Button {...args}>{context.name}</Button>,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const All: Story = {
  render: (args: ComponentProps<typeof Button>) => (
    <PseudoStateGrid render={(label) => <Button {...args}>{label}</Button>} />
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
