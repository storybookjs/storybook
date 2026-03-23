import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { styled } from 'storybook/theming';

import type { ActionDisplay } from '../../models';
import { ActionLogger } from './index';

const StyledWrapper = styled.div(({ theme }) => ({
  backgroundColor: theme.background.content,
  color: theme.color.defaultText,
  display: 'block',
  height: '400px',
  position: 'relative',
  overflow: 'auto',
}));

function makeAction(name: string, args: any[], count: number = 1, id: string): ActionDisplay {
  return {
    id,
    data: { name, args },
    count,
    options: { limit: 50, clearOnStoryChange: true },
  };
}

const meta = {
  title: 'ActionLogger',
  component: ActionLogger,
  decorators: [
    (Story: any) => (
      <StyledWrapper>
        <Story />
      </StyledWrapper>
    ),
  ],
  parameters: { layout: 'fullscreen' },
  args: {
    actions: [],
    onClear: () => {},
    expandLevel: 1,
  },
} as Meta<typeof ActionLogger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const SingleAction: Story = {
  args: {
    actions: [makeAction('onClick', [{ target: 'button' }], 1, 'action-click')],
  },
};

export const RepeatedAction: Story = {
  args: {
    actions: [makeAction('onClick', [{ target: 'button' }], 5, 'action-repeated')],
  },
};

export const MultipleActions: Story = {
  args: {
    actions: [
      makeAction('onClick', [{ target: 'button' }], 1, 'action-1'),
      makeAction('onChange', ['new value'], 1, 'action-2'),
      makeAction('onSubmit', [{ formData: { name: 'test' } }], 1, 'action-3'),
    ],
  },
};

export const AtLimit: Story = {
  name: 'At limit (5 actions)',
  args: {
    actions: Array.from({ length: 5 }, (_, i) =>
      makeAction(`onEvent${i + 1}`, [`arg-${i + 1}`], 1, `action-${i + 1}`)
    ),
  },
};

export const ManyActions: Story = {
  name: 'Many actions (scrollable)',
  args: {
    actions: Array.from({ length: 30 }, (_, i) =>
      makeAction(
        i % 2 === 0 ? 'onClick' : 'onChange',
        [{ index: i, value: `item-${i}` }],
        1,
        `action-${i}`
      )
    ),
  },
};

export const NestedData: Story = {
  args: {
    actions: [
      makeAction(
        'onUpdate',
        [
          {
            user: {
              name: 'Alice',
              address: { street: '123 Main St', city: 'Springfield' },
              tags: ['admin', 'editor'],
            },
          },
        ],
        1,
        'action-nested'
      ),
    ],
    expandLevel: 3,
  },
};
