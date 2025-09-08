import React from 'react';

import { Button } from 'storybook/internal/components';

import { CloseAltIcon } from '@storybook/icons';

import { fn } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { Overlay } from './Overlay';

const SampleTooltip = () => 'Lorem ipsum dolor sit amet';

const SamplePopover = () => (
  <div>
    <h3>Lorem ipsum dolor sit amet</h3>
    <p>Consectatur vestibulum concet durum politu coret weirom</p>
    <button onClick={fn()}>Continue</button>
  </div>
);

const meta = preview.meta({
  id: 'overlay-component',
  title: 'Overlay/Overlay',
  component: Overlay,
  args: {
    children: <SamplePopover />,
    color: undefined,
    hasChrome: true,
  },
  argTypes: {
    color: {
      type: 'string',
      control: 'select',
      options: ['default', 'inverse', 'positive', 'negative', 'warning'],
    },
  },
});

export const AsTooltip = meta.story({
  args: {
    children: <SampleTooltip />,
  },
});

export const AsPopover = meta.story({
  args: {
    children: <SamplePopover />,
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

export const WithHideButton = meta.story({
  args: {
    hasChrome: true,
    onHide: fn(),
  },
});

export const WithCustomHideLabel = meta.story({
  args: {
    hasChrome: true,
    onHide: fn(),
    hideLabel: 'Close Overlay',
  },
});

export const WithHideButtonAndPadding = meta.story({
  args: {
    children: (
      <div>
        When the close button covers content, setting <code>padding</code> to{' '}
        <code>8px 40px 8px 8px</code> solves simple use cases.
      </div>
    ),
    hasChrome: true,
    onHide: fn(),
    padding: '8px 40px 8px 8px',
  },
});

export const WithCustomHideButton = meta.story({
  args: {
    children: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>For more advanced use cases, pass your own close button to the overlay.</div>
        <Button
          ariaLabel="Close Overlay"
          onClick={fn()}
          size="small"
          padding="small"
          variant="ghost"
        >
          <CloseAltIcon />
        </Button>
      </div>
    ),
    hasChrome: true,
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
