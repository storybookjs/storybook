import React from 'react';

import { FaceHappyIcon } from '@storybook/icons';

import { expect, spyOn } from 'storybook/test';
import { styled } from 'storybook/theming';

import preview from '../../../../../.storybook/preview';
import { IconButton } from './IconButton';

const meta = preview.meta({
  id: 'iconbutton-component',
  title: 'IconButton',
  component: IconButton,
  tags: ['autodocs'],
  args: { children: <FaceHappyIcon /> },
  beforeEach() {
    spyOn(console, 'warn').mockName('console.warn');
  },
});

const Stack = styled.div({ display: 'flex', flexDirection: 'column', gap: '1rem' });

const Row = styled.div({ display: 'flex', alignItems: 'center', gap: '1rem' });

export const Base = meta.story({});

export const Variants = meta.story({
  render: ({ ...args }) => (
    <Row>
      <IconButton {...args} variant="solid" />
      <IconButton {...args} variant="outline" />
      <IconButton {...args} variant="ghost" />
    </Row>
  ),
});

export const PseudoStates = meta.story({
  render: ({ ...args }) => (
    <Stack>
      <Row>
        <IconButton {...args} ariaLabel="IconButton" variant="solid" />
        <IconButton {...args} ariaLabel="IconButton" variant="outline" />
        <IconButton {...args} ariaLabel="IconButton" variant="ghost" />
      </Row>
      <Row id="hover">
        <IconButton {...args} ariaLabel="Hover" variant="solid" />
        <IconButton {...args} ariaLabel="Hover" variant="outline" />
        <IconButton {...args} ariaLabel="Hover" variant="ghost" />
      </Row>
      <Row id="focus">
        <IconButton {...args} ariaLabel="Focus" variant="solid" />
        <IconButton {...args} ariaLabel="Focus" variant="outline" />
        <IconButton {...args} ariaLabel="Focus" variant="ghost" />
      </Row>
      <Row id="focus-visible">
        <IconButton {...args} ariaLabel="Focus visible" variant="solid" />
        <IconButton {...args} ariaLabel="Focus visible" variant="outline" />
        <IconButton {...args} ariaLabel="Focus visible" variant="ghost" />
      </Row>
    </Stack>
  ),
  parameters: {
    pseudo: {
      hover: '#hover button',
      focus: '#focus button',
      focusVisible: '#focus-visible button',
    },
  },
});

export const Sizes = meta.story({
  args: { variant: 'solid' },
  render: ({ ...args }) => (
    <Row>
      <IconButton {...args} size="small" />
      <IconButton {...args} size="medium" />
    </Row>
  ),
});

export const Paddings = meta.story({
  args: { variant: 'solid' },
  render: ({ ...args }) => (
    <Stack>
      <Row>
        <IconButton {...args} size="small" padding="small">
          Small Padding
        </IconButton>
        <IconButton {...args} size="small" padding="medium">
          Medium Padding
        </IconButton>
      </Row>
      <Row>
        <IconButton {...args} size="medium" padding="small">
          Small Padding
        </IconButton>
        <IconButton {...args} size="medium" padding="medium">
          Medium Padding
        </IconButton>
      </Row>
    </Stack>
  ),
});

export const Disabled = meta.story({
  args: { disabled: true },
  render: ({ ...args }) => (
    <Row>
      <IconButton {...args} variant="solid" />
      <IconButton {...args} variant="outline" />
      <IconButton {...args} variant="ghost" />
    </Row>
  ),
});

export const Animated = meta.story({
  render: ({ ...args }) => (
    <Row>
      <IconButton {...args} animation="glow" />
      <IconButton {...args} animation="rotate360" />
      <IconButton {...args} animation="jiggle" />
    </Row>
  ),
});

export const WithHref = meta.story({
  render: ({ ...args }) => (
    <Row>
      <IconButton {...args} ariaLabel="Say hello" onClick={() => console.log('Hello')} />
      <IconButton {...args} ariaLabel="Visit Storybook website" asChild>
        <a href="https://storybook.js.org/">
          <FaceHappyIcon />
        </a>
      </IconButton>
    </Row>
  ),
});

export const MissingAriaLabel = meta.story({
  args: { ariaLabel: undefined, title: 'Button' },
  play: () => {
    expect(console.warn).toHaveBeenCalledWith(
      'IconButton requires an aria-label to be accessible (title: Button; tooltip: ø).'
    );
  },
});
