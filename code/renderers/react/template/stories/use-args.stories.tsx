import type { FC } from 'react';
import React from 'react';

import { useArgs } from 'storybook/preview-api';

interface ControlledProps {
  value: string;
  onChange?: (value: string) => void;
}

// Minimal controlled component: renders its current `value` arg and updates it
// on click. Used to reproduce #28333 — when this runs inside a <Stories> block,
// `updateArgs` must target *this* story, not the page's primary story.
const Controlled: FC<ControlledProps> = ({ value, onChange }) => (
  <button type="button" data-testid="value" onClick={() => onChange?.(`${value}-updated`)}>
    {value}
  </button>
);

export default {
  component: Controlled,
  tags: ['autodocs'],
  render: (args: ControlledProps) => {
    const [, updateArgs] = useArgs();
    return <Controlled {...args} onChange={(value) => updateArgs({ value })} />;
  },
  parameters: { chromatic: { disableSnapshot: true } },
};

export const StoryA = { args: { value: 'story-a' } };

export const StoryB = { args: { value: 'story-b' } };
