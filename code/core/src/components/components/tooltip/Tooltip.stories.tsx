import type { ComponentProps } from 'react';
import React from 'react';

import { styled } from '@storybook/core/theming';

import { Tooltip } from './Tooltip';

// Popper would position the tooltip absolutely. We just need to make sure we are pos:rel
const mockPopperProps = {
  style: {
    position: 'relative',
    top: 20,
    left: 20,
  },
};
const Content = styled.div({
  width: '100px',
  height: '100px',
  fontSize: '16px',
  textAlign: 'center',
  lineHeight: '100px',
});

export default {
  component: Tooltip,
  args: mockPopperProps,
};

export const BasicDefault = {
  // args: mockPopperProps,
  render: (args: ComponentProps<typeof Tooltip>) => (
    <Tooltip {...args}>
      <Content>Text</Content>
    </Tooltip>
  ),
};

export const BasicDefaultBottom = {
  args: {
    // ...mockPopperProps,
    placement: 'bottom',
  },
  render: (args: ComponentProps<typeof Tooltip>) => (
    <Tooltip {...args}>
      <Content>Text</Content>
    </Tooltip>
  ),
};

export const BasicDefaultLeft = {
  args: {
    // ...mockPopperProps,
    placement: 'left',
  },
  render: (args: ComponentProps<typeof Tooltip>) => (
    <Tooltip {...args}>
      <Content>Text</Content>
    </Tooltip>
  ),
};

export const BasicDefaultRight = {
  args: {
    // ...mockPopperProps,
    placement: 'right',
  },
  render: (args: ComponentProps<typeof Tooltip>) => (
    <Tooltip {...args}>
      <Content>Text</Content>
    </Tooltip>
  ),
};

export const WithoutChrome = {
  args: {
    // ...mockPopperProps,
    hasChrome: false,
  },
  render: (args: ComponentProps<typeof Tooltip>) => (
    <Tooltip {...args}>
      <Content>Text</Content>
    </Tooltip>
  ),
};
