import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ColorControl } from './Color';

const meta = {
  component: ColorControl,
  parameters: { withRawArg: 'value', controls: { include: ['value', 'startOpen'] } },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: {
        type: 'color',
      },
    },
  },
  args: { name: 'color', onChange: fn() },
} satisfies Meta<typeof ColorControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    value: '#ff00ff',
  },
};

export const Undefined: Story = {
  args: {
    value: undefined,
  },
};

export const WithPresetColors: Story = {
  args: {
    value: '#00ffff',
    presetColors: [
      { color: '#ff4785', title: 'Coral' },
      { color: '#1EA7FD', title: 'Ocean' },
      { color: 'rgb(252, 82, 31)', title: 'Orange' },
      { color: 'RGBA(255, 174, 0, 0.5)', title: 'Gold' },
      { color: 'hsl(101, 52%, 49%)', title: 'Green' },
      { color: 'HSLA(179,65%,53%,0.5)', title: 'Seafoam' },
      { color: '#6F2CAC', title: 'Purple' },
      { color: '#2A0481', title: 'Ultraviolet' },
      { color: 'black' },
      { color: '#333', title: 'Darkest' },
      { color: '#444', title: 'Darker' },
      { color: '#666', title: 'Dark' },
      { color: '#999', title: 'Mediumdark' },
      { color: '#ddd', title: 'Medium' },
      { color: '#EEE', title: 'Mediumlight' },
      { color: '#F3F3F3', title: 'Light' },
      { color: '#F8F8F8', title: 'Lighter' },
      { color: '#FFFFFF', title: 'Lightest' },
      '#fe4a49',
      '#FED766',
      'rgba(0, 159, 183, 1)',
      'HSLA(240,11%,91%,0.5)',
      'slategray',
    ],
  },
};

export const StartOpen: Story = {
  args: {
    startOpen: true,
  },
};

export const Readonly: Story = {
  args: {
    value: '#ff00ff',
    argType: { table: { readonly: true } },
  },
};
