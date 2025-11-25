import React from 'react';

import { Button } from 'storybook/internal/components';

import preview from '../../../../../.storybook/preview';
import { Toolbar } from './Toolbar';

const Children = () => (
  <>
    <Button ariaLabel={false} key="button1">
      Button 1
    </Button>
    <Button ariaLabel={false} key="button2">
      Button 2
    </Button>
    <Button ariaLabel={false} key="button3">
      Button 3
    </Button>
    <Button ariaLabel={false} key="button4">
      Button 4
    </Button>
    <Button ariaLabel={false} key="button5">
      Button 5
    </Button>
    <Button ariaLabel={false} key="button6">
      Button 6
    </Button>
    <Button ariaLabel={false} key="button7">
      Button 7
    </Button>
    <Button ariaLabel={false} key="button8">
      Button 8
    </Button>
  </>
);

const meta = preview.meta({
  title: 'Toolbar',
  component: Toolbar,
  args: {
    children: <Children />,
  },
});

export const Basic = meta.story({});

export const Scrollable = meta.story({
  args: {
    scrollable: true,
  },
  render: (args) => <div style={{ width: 400 }}>{<Toolbar {...args} />}</div>,
});

export const NotScrollable = meta.story({
  args: {
    scrollable: false,
  },
  render: (args) => <div style={{ width: 400 }}>{<Toolbar {...args} />}</div>,
});

export const Border = meta.story({
  args: {
    border: true,
  },
});
