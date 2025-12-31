import React, { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { styled } from 'storybook/theming';

import { ToggleButton } from './ToggleButton';

const meta = {
  title: 'ToggleButton',
  component: ToggleButton,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { ariaLabel: false, children: 'Click me' },
} satisfies Meta<typeof ToggleButton>;

export default meta;
type Story = StoryObj<typeof meta>;

const Stack = styled.div({ display: 'flex', flexDirection: 'column', gap: '1rem' });

const Row = styled.div({ display: 'flex', alignItems: 'center', gap: '1rem' });

export const Base: Story = {
  args: { pressed: false },
  render: ({ pressed, ...args }) => {
    const [isPressed, setIsPressed] = useState(pressed);
    const handleOnClick = () => setIsPressed((prev) => !prev);

    return <ToggleButton {...args} pressed={isPressed} onClick={handleOnClick} />;
  },
};

export const Pressed: Story = {
  args: { pressed: true },
  render: ({ pressed, ...args }) => {
    const [isPressed, setIsPressed] = useState(pressed);
    const handleOnClick = () => setIsPressed((prev) => !prev);

    return <ToggleButton {...args} pressed={isPressed} onClick={handleOnClick} />;
  },
};

export const Variants: Story = {
  args: { pressed: false },
  render: (args) => {
    return (
      <Stack>
        <Row>Unpressed</Row>
        <Row>
          <ToggleButton {...args} pressed={false} variant="solid" />
          <ToggleButton {...args} pressed={false} variant="outline" />
          <ToggleButton {...args} pressed={false} variant="ghost" />
        </Row>
        <Row>Pressed</Row>
        <Row>
          <ToggleButton {...args} pressed={true} variant="solid" />
          <ToggleButton {...args} pressed={true} variant="outline" />
          <ToggleButton {...args} pressed={true} variant="ghost" />
        </Row>
      </Stack>
    );
  },
};

export const Sizes: Story = {
  args: { pressed: false, variant: 'solid' },
  render: ({ ...args }) => (
    <Row>
      <ToggleButton {...args} size="medium" />
      <ToggleButton {...args} size="small" />
    </Row>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, pressed: false },
  render: (args) => {
    return (
      <Stack>
        <Row>Unpressed</Row>
        <Row>
          <ToggleButton {...args} pressed={false} variant="solid" />
          <ToggleButton {...args} pressed={false} variant="outline" />
          <ToggleButton {...args} pressed={false} variant="ghost" />
        </Row>
        <Row>Pressed</Row>
        <Row>
          <ToggleButton {...args} pressed={true} variant="solid" />
          <ToggleButton {...args} pressed={true} variant="outline" />
          <ToggleButton {...args} pressed={true} variant="ghost" />
        </Row>
      </Stack>
    );
  },
};
