import React from 'react';

import preview from '../../../../../.storybook/preview';
import { Tooltip } from './Tooltip';

const SampleTooltip = () => (
  <div>
    <h3>Lorem ipsum dolor sit amet</h3>
    <p>Consectatur vestibulum concet durum politu coret weirom</p>
  </div>
);

const meta = preview.meta({
  id: 'overlay-Tooltip',
  title: 'Overlay/Tooltip',
  component: Tooltip,
  args: {
    children: <SampleTooltip />,
    color: undefined,
    hasChrome: true,
  },
  argTypes: {
    color: {
      type: 'string',
      control: 'select',
      options: ['default', 'inverse', 'positive', 'negative', 'warning', 'none'],
    },
  },
});

export const Base = meta.story({
  args: {
    children: <SampleTooltip />,
  },
});

export const WithChrome = meta.story({
  args: {
    hasChrome: true,
  },
});

export const WithoutChrome = meta.story({
  args: {
    hasChrome: false,
  },
});

export const ColorDefault = meta.story({
  args: {
    color: 'default',
  },
});

export const ColorInverse = meta.story({
  args: {
    color: 'inverse',
  },
});

export const ColorPositive = meta.story({
  args: {
    color: 'positive',
  },
});

export const ColorNegative = meta.story({
  args: {
    color: 'negative',
  },
});

export const ColorWarning = meta.story({
  args: {
    color: 'warning',
  },
});

export const WithoutColor = meta.story({
  args: {
    color: 'none',
  },
});
