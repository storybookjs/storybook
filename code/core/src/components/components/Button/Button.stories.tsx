import type { ReactNode } from 'react';
import React from 'react';

import { FaceHappyIcon } from '@storybook/icons';

import preview from '../../../../../.storybook/preview';
import { Button } from './Button';

const meta = preview.meta({
  id: 'button-component',
  title: 'Button',
  component: Button,
  args: { children: 'Button' },
});

const Stack = ({ children }: { children: ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{children}</div>
);

const Row = ({ children }: { children: ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>{children}</div>
);

export const Base = meta.story({});

export const Variants = meta.story({
  render: (args) => (
    <Stack>
      <Row>
        <Button variant="solid" {...args}>
          Solid
        </Button>
        <Button variant="outline" {...args}>
          Outline
        </Button>
        <Button variant="ghost" {...args}>
          Ghost
        </Button>
      </Row>
      <Row>
        <Button variant="solid" {...args}>
          <FaceHappyIcon /> Solid
        </Button>
        <Button variant="outline" {...args}>
          <FaceHappyIcon /> Outline
        </Button>
        <Button variant="ghost" {...args}>
          <FaceHappyIcon /> Ghost
        </Button>
      </Row>
      <Row>
        <Button variant="solid" padding="small" {...args}>
          <FaceHappyIcon />
        </Button>
        <Button variant="outline" padding="small" {...args}>
          <FaceHappyIcon />
        </Button>
        <Button variant="ghost" padding="small" {...args}>
          <FaceHappyIcon />
        </Button>
      </Row>
    </Stack>
  ),
});

export const Active = meta.story({
  args: {
    active: true,
    children: (
      <>
        <FaceHappyIcon />
        Button
      </>
    ),
  },
  render: (args) => (
    <Row>
      <Button variant="solid" {...args} />
      <Button variant="outline" {...args} />
      <Button variant="ghost" {...args} />
    </Row>
  ),
});

export const WithIcon = meta.story({
  args: {
    children: (
      <>
        <FaceHappyIcon />
        Button
      </>
    ),
  },
  render: (args) => (
    <Row>
      <Button variant="solid" {...args} />
      <Button variant="outline" {...args} />
      <Button variant="ghost" {...args} />
    </Row>
  ),
});

export const IconOnly = meta.story({
  args: {
    children: <FaceHappyIcon />,
    padding: 'small',
  },
  render: (args) => (
    <Row>
      <Button variant="solid" {...args} />
      <Button variant="outline" {...args} />
      <Button variant="ghost" {...args} />
    </Row>
  ),
});

export const Sizes = meta.story({
  render: () => (
    <Row>
      <Button size="small">Small Button</Button>
      <Button size="medium">Medium Button</Button>
    </Row>
  ),
});

export const Disabled = meta.story({
  args: {
    disabled: true,
    children: 'Disabled Button',
  },
});

export const WithHref = meta.story({
  render: () => (
    <Row>
      <Button onClick={() => console.log('Hello')}>I am a button using onClick</Button>
      <Button asChild>
        <a href="https://storybook.js.org/">I am an anchor using Href</a>
      </Button>
    </Row>
  ),
});

export const Animated = meta.story({
  args: {
    variant: 'outline',
  },
  render: (args) => (
    <Stack>
      <Row>
        <Button animation="glow" {...args}>
          Button
        </Button>
        <Button animation="jiggle" {...args}>
          Button
        </Button>
        <Button animation="rotate360" {...args}>
          Button
        </Button>
      </Row>
      <Row>
        <Button animation="glow" {...args}>
          <FaceHappyIcon /> Button
        </Button>
        <Button animation="jiggle" {...args}>
          <FaceHappyIcon /> Button
        </Button>
        <Button animation="rotate360" {...args}>
          <FaceHappyIcon /> Button
        </Button>
      </Row>
      <Row>
        <Button animation="glow" padding="small" {...args}>
          <FaceHappyIcon />
        </Button>
        <Button animation="jiggle" padding="small" {...args}>
          <FaceHappyIcon />
        </Button>
        <Button animation="rotate360" padding="small" {...args}>
          <FaceHappyIcon />
        </Button>
      </Row>
    </Stack>
  ),
});
