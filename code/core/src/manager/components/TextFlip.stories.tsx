import type { ComponentProps } from 'react';
import { useState } from 'react';

import preview from '../../../../.storybook/preview';
import { Button } from '../../components';
import { TextFlip } from './TextFlip';

const Counter = ({
  text,
  reverse = false,
  ...props
}: { text: string; reverse?: boolean } & ComponentProps<typeof TextFlip>) => {
  const [value, setValue] = useState(Number(text));
  return (
    <Button onClick={() => setValue(reverse ? value - 1 : value + 1)}>
      <TextFlip text={String(value)} {...props} />
    </Button>
  );
};

const meta = preview.meta({
  component: TextFlip,
  args: {
    text: 'Use controls to change this',
    placeholder: 'This is some long placeholder text',
  },
  render: (args) => (
    <Button>
      <TextFlip {...args} />
    </Button>
  ),
});

export const Default = meta.story({});

export const Increasing = meta.story({
  render: () => <Counter placeholder="00" text="1" />,
});

export const Decreasing = meta.story({
  render: () => <Counter placeholder="00" text="99" reverse />,
});
