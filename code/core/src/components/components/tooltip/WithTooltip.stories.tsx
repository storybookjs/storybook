import type { ComponentProps, FunctionComponent } from 'react';
import React from 'react';

import { styled } from '@storybook/core/theming';
import type { StoryObj } from '@storybook/react';
import { expect, screen } from '@storybook/test';

import { TooltipMessage } from './TooltipMessage';
import { WithToolTipState as WithTooltip } from './WithTooltip';

const ViewPort = styled.div({
  height: 300,
});

const BackgroundBox = styled.div({
  width: 500,
  height: 500,
  overflowY: 'scroll',
  background: '#eee',
  position: 'relative',
});

const Spacer = styled.div({
  height: 100,
});

const Trigger = styled.div({
  width: 200,
  height: 100,
  backgroundColor: 'red',
  color: 'white',
});

interface TooltipProps {
  onHide?: () => void;
}

const Tooltip: FunctionComponent<TooltipProps> = ({ onHide }) => (
  <TooltipMessage
    title="Lorem ipsum dolor sit"
    desc="Amet consectatur vestibulum concet durum politu coret weirom"
    links={[
      {
        title: 'Continue',
        onClick: onHide,
      },
    ]}
  />
);

export default {
  component: WithTooltip,
  decorators: [
    (storyFn: any) => (
      <ViewPort>
        <BackgroundBox>
          <Spacer />
          {storyFn()}
        </BackgroundBox>
      </ViewPort>
    ),
  ],
};

export const SimpleHover: StoryObj<ComponentProps<typeof WithTooltip>> = {
  args: {
    placement: 'top',
    trigger: 'hover',
  },
  render: (args) => (
    <WithTooltip {...args} tooltip={<Tooltip />}>
      <Trigger>Hover me!</Trigger>
    </WithTooltip>
  ),
};

export const SimpleHoverFunctional: StoryObj<ComponentProps<typeof WithTooltip>> = {
  args: {
    placement: 'top',
    trigger: 'hover',
  },
  render: (args) => (
    <WithTooltip {...args} tooltip={Tooltip}>
      <Trigger>Hover me!</Trigger>
    </WithTooltip>
  ),
};

export const SimpleClick: StoryObj<ComponentProps<typeof WithTooltip>> = {
  args: {
    placement: 'top',
  },
  render: (args) => (
    <WithTooltip {...args} tooltip={<Tooltip />}>
      <Trigger>Click me!</Trigger>
    </WithTooltip>
  ),
};

export const SimpleClickStartOpen: StoryObj<ComponentProps<typeof WithTooltip>> = {
  args: {
    placement: 'top',
    startOpen: true,
  },
  render: (args) => (
    <WithTooltip {...args} tooltip={<Tooltip />}>
      <Trigger>Click me!</Trigger>
    </WithTooltip>
  ),
  play: async () => {
    await expect(await screen.findByText('Lorem ipsum dolor sit')).toBeInTheDocument();
  },
};

export const SimpleClickCloseOnClick: StoryObj<ComponentProps<typeof WithTooltip>> = {
  args: {
    placement: 'top',
    closeOnOutsideClick: true,
  },
  render: (args) => (
    <WithTooltip {...args} tooltip={<Tooltip />}>
      <Trigger>Click me!</Trigger>
    </WithTooltip>
  ),
};

export const WithoutChrome: StoryObj<ComponentProps<typeof WithTooltip>> = {
  args: {
    placement: 'top',
    hasChrome: false,
  },
  render: (args) => (
    <WithTooltip {...args} tooltip={<Tooltip />}>
      <Trigger>Click me!</Trigger>
    </WithTooltip>
  ),
};
