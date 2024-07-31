import React from 'react';
import type { Meta } from '@storybook/react';
import { WithTooltip } from './WithTooltip';
import { TooltipMessage } from './TooltipMessage';

export default {
  component: TooltipMessage,
  decorators: [
    (storyFn) => (
      <div
        style={{
          height: '300px',
        }}
      >
        <WithTooltip placement="top" startOpen tooltip={storyFn()}>
          <div>Tooltip</div>
        </WithTooltip>
      </div>
    ),
  ],
} as Meta;

export const Default = {
  args: {
    title: 'The title',
    desc: 'The longest of the long description',
  },
};

export const WithSingleLink = {
  args: {
    title: 'The title',
    desc: 'The longest of the long description',
    links: [
      {
        title: 'Continue',
        href: 'test',
      },
    ],
  },
};

export const WithMultipleLinks = {
  args: {
    title: 'The title',
    desc: 'The longest of the long description',
    links: [
      {
        title: 'Get more tips',
        href: 'test',
      },
      {
        title: 'Done',
        href: 'test',
      },
    ],
  },
};

export const DescriptionOnly = {
  args: {
    desc: 'The description',
  },
};
