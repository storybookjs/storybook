import type { Meta, StoryFn, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta = {
  title: 'Edge/Legacy',
  component: Button,
  includeStories: /^[A-Z]/,
  excludeStories: ['Helper'],
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;
export default meta;

export const Helper = () => null;

const Template: StoryFn<typeof Button> = (args) => <Button {...args} />;

export const Bound = Template.bind({});
Bound.args = { label: 'Bound' };
Bound.storyName = 'Bound story';
Bound.parameters = { __id: 'edge-legacy--custom-id' };

export const Cast = Template.bind({}) as typeof Template & StoryObj;
Cast.args = { label: 'Cast' };

export const WithPlay: StoryObj<typeof meta> = {
  args: { label: 'Play' },
  play: async ({ canvasElement, mount }) => {
    await mount();
  },
};

export function Declared() {
  return <Button label="Declared" />;
}

const Local: StoryObj<typeof meta> = { args: { label: 'Alias' } };
export { Local as Alias };
