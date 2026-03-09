import React from 'react';

import type { DecoratorFunction } from 'storybook/internal/csf';

import type { Meta } from '@storybook/react-vite';

import { Button } from '../Button/Button';
import { PopoverProvider } from '../Popover/PopoverProvider';
import { TooltipMessage } from './TooltipMessage';
import { WithTooltip } from './WithTooltip';

const WithTooltipDecorator: DecoratorFunction = (storyFn) => (
  <div
    style={{
      height: '300px',
    }}
  >
    <WithTooltip placement="top" startOpen tooltip={storyFn()}>
      <div>Tooltip</div>
    </WithTooltip>
  </div>
);

const WithPopoverDecorator: DecoratorFunction = (storyFn) => (
  <div
    style={{
      height: '300px',
    }}
  >
    <PopoverProvider
      ariaLabel="Tooltip message"
      placement="top"
      visible
      padding={0}
      popover={storyFn()}
    >
      <Button ariaLabel={false}>Popover</Button>
    </PopoverProvider>
  </div>
);

export default {
  component: TooltipMessage,
} as Meta;

export const Default = {
  args: {
    title: 'The title',
    desc: 'The longest of the long description',
  },
  decorators: [WithTooltipDecorator],
};

export const DefaultPopover = {
  args: {
    title: 'The title',
    desc: 'The longest of the long description',
  },
  decorators: [WithPopoverDecorator],
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
  decorators: [WithTooltipDecorator],
};

export const WithSingleLinkPopover = {
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
  decorators: [WithPopoverDecorator],
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
  decorators: [WithTooltipDecorator],
};

export const WithMultipleLinksPopover = {
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
  decorators: [WithPopoverDecorator],
};

export const DescriptionOnly = {
  args: {
    desc: 'The description',
  },
  decorators: [WithTooltipDecorator],
};

export const DescriptionOnlyPopover = {
  args: {
    desc: 'The description',
  },
  decorators: [WithPopoverDecorator],
};
