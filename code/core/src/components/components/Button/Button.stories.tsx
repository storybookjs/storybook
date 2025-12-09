import React from 'react';

import { FaceHappyIcon } from '@storybook/icons';

import { fn } from 'storybook/test';
import { styled } from 'storybook/theming';

import preview from '../../../../../.storybook/preview';
import { Button } from './Button';

const meta = preview.meta({
  id: 'button-component',
  title: 'Button',
  component: Button,
  args: { onClick: fn() },
});

const Stack = styled.div({ display: 'flex', flexDirection: 'column', gap: '1rem' });

const Row = styled.div({ display: 'flex', alignItems: 'center', gap: '1rem' });

export const Base = meta.story({
  args: { ariaLabel: false, children: 'Button' },
});

/** This is the variant most commonly used in a toolbar or when a button only contains an icon. */
export const IconButton = meta.story({
  args: {
    ariaLabel: 'Button',
    children: <FaceHappyIcon />,
    padding: 'small',
    variant: 'ghost',
  },
});

export const Variants = meta.story({
  args: { ariaLabel: false, children: 'Button' },
  render: (args) => (
    <Stack>
      <Row>
        <Button {...args} variant="solid" ariaLabel={false}>
          Solid
        </Button>
        <Button {...args} variant="outline" ariaLabel={false}>
          Outline
        </Button>
        <Button {...args} variant="ghost" ariaLabel={false}>
          Ghost
        </Button>
      </Row>
      <Row>
        <Button {...args} variant="solid" ariaLabel={false}>
          <FaceHappyIcon /> Solid
        </Button>
        <Button {...args} variant="outline" ariaLabel={false}>
          <FaceHappyIcon /> Outline
        </Button>
        <Button {...args} variant="ghost" ariaLabel={false}>
          <FaceHappyIcon /> Ghost
        </Button>
      </Row>
      <Row>
        <Button {...args} variant="solid" padding="small" ariaLabel="Button">
          <FaceHappyIcon />
        </Button>
        <Button {...args} variant="outline" padding="small" ariaLabel="Button">
          <FaceHappyIcon />
        </Button>
        <Button {...args} variant="ghost" padding="small" ariaLabel="Button">
          <FaceHappyIcon />
        </Button>
      </Row>
    </Stack>
  ),
});

export const PseudoStates = meta.story({
  render: () => (
    <Stack>
      <Row>
        <Button ariaLabel={false} variant="solid">
          Button
        </Button>
        <Button ariaLabel={false} variant="outline">
          Button
        </Button>
        <Button ariaLabel={false} variant="ghost">
          Button
        </Button>
      </Row>
      <Row id="hover">
        <Button ariaLabel={false} variant="solid">
          Hover
        </Button>
        <Button ariaLabel={false} variant="outline">
          Hover
        </Button>
        <Button ariaLabel={false} variant="ghost">
          Hover
        </Button>
      </Row>
      <Row id="active">
        <Button ariaLabel={false} variant="solid">
          Active
        </Button>
        <Button ariaLabel={false} variant="outline">
          Active
        </Button>
        <Button ariaLabel={false} variant="ghost">
          Active
        </Button>
      </Row>
      <Row id="focus">
        <Button ariaLabel={false} variant="solid">
          Focus
        </Button>
        <Button ariaLabel={false} variant="outline">
          Focus
        </Button>
        <Button ariaLabel={false} variant="ghost">
          Focus
        </Button>
      </Row>
      <Row id="focus-visible">
        <Button ariaLabel={false} variant="solid">
          Focus Visible
        </Button>
        <Button ariaLabel={false} variant="outline">
          Focus Visible
        </Button>
        <Button ariaLabel={false} variant="ghost">
          Focus Visible
        </Button>
      </Row>
    </Stack>
  ),
  parameters: {
    pseudo: {
      hover: '#hover button',
      active: '#active button',
      focus: '#focus button',
      focusVisible: '#focus-visible button',
    },
  },
});

export const Active = meta.story({
  name: 'Active (deprecated)',
  args: { ariaLabel: false, active: true },
  render: (args) => (
    <Stack>
      <Row>
        <Button {...args} variant="solid">
          Button
        </Button>
        <Button {...args} variant="outline">
          Button
        </Button>
        <Button {...args} variant="ghost">
          Button
        </Button>
      </Row>
      <Row id="hover">
        <Button {...args} variant="solid">
          Hover
        </Button>
        <Button {...args} variant="outline">
          Hover
        </Button>
        <Button {...args} variant="ghost">
          Hover
        </Button>
      </Row>
      <Row id="active">
        <Button {...args} variant="solid">
          active
        </Button>
        <Button {...args} variant="outline">
          active
        </Button>
        <Button {...args} variant="ghost">
          active
        </Button>
      </Row>
      <Row id="focus">
        <Button {...args} variant="solid">
          Focus
        </Button>
        <Button {...args} variant="outline">
          Focus
        </Button>
        <Button {...args} variant="ghost">
          Focus
        </Button>
      </Row>
      <Row id="focus-visible">
        <Button {...args} variant="solid">
          Focus Visible
        </Button>
        <Button {...args} variant="outline">
          Focus Visible
        </Button>
        <Button {...args} variant="ghost">
          Focus Visible
        </Button>
      </Row>
    </Stack>
  ),
  parameters: {
    pseudo: {
      hover: '#hover button',
      active: '#active button',
      focus: '#focus button',
      focusVisible: '#focus-visible button',
    },
  },
});

export const WithIcon = meta.story({
  args: {
    ariaLabel: false,
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
    ariaLabel: 'Button',
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
      <Button ariaLabel={false} size="small">
        Small Button
      </Button>
      <Button ariaLabel={false} size="medium">
        Medium Button
      </Button>
    </Row>
  ),
});

export const Paddings = meta.story({
  render: () => (
    <Stack>
      <Row>
        <Button ariaLabel={false} size="small" padding="small">
          Small Padding
        </Button>
        <Button ariaLabel={false} size="small" padding="medium">
          Medium Padding
        </Button>
      </Row>
      <Row>
        <Button ariaLabel={false} size="medium" padding="small">
          Small Padding
        </Button>
        <Button ariaLabel={false} size="medium" padding="medium">
          Medium Padding
        </Button>
      </Row>
    </Stack>
  ),
});

export const Disabled = meta.story({
  args: {
    ariaLabel: false,
    disabled: true,
    children: 'Disabled Button',
  },
});

export const ReadOnly = meta.story({
  args: {
    ariaLabel: false,
    readOnly: true,
    children: 'ReadOnly Button',
  },
});

export const WithHref = meta.story({
  render: () => (
    <Row>
      <Button ariaLabel={false} onClick={() => console.log('Hello')}>
        I am a button using onClick
      </Button>
      <Button ariaLabel={false} asChild>
        <a href="https://storybook.js.org/">I am an anchor using Href</a>
      </Button>
    </Row>
  ),
});

export const Animated = meta.story({
  args: {
    ariaLabel: false,
    variant: 'outline',
  },
  render: (args) => (
    <Stack>
      <Row>
        <Button {...args} animation="glow">
          Button
        </Button>
        <Button {...args} animation="jiggle">
          Button
        </Button>
        <Button {...args} animation="rotate360">
          Button
        </Button>
      </Row>
      <Row>
        <Button {...args} animation="glow">
          <FaceHappyIcon /> Button
        </Button>
        <Button {...args} animation="jiggle">
          <FaceHappyIcon /> Button
        </Button>
        <Button {...args} animation="rotate360">
          <FaceHappyIcon /> Button
        </Button>
      </Row>
      <Row>
        <Button {...args} ariaLabel="Happy" animation="glow" padding="small">
          <FaceHappyIcon />
        </Button>
        <Button {...args} ariaLabel="Happy" animation="jiggle" padding="small">
          <FaceHappyIcon />
        </Button>
        <Button {...args} ariaLabel="Happy" animation="rotate360" padding="small">
          <FaceHappyIcon />
        </Button>
      </Row>
    </Stack>
  ),
});

export const AriaLabel = meta.story({
  args: {
    ariaLabel: 'Button',
    children: <FaceHappyIcon />,
  },
});

export const Tooltip = meta.story({
  args: {
    ariaLabel: false,
    children: 'Button',
    tooltip: 'A button can be pressed to perform an action',
  },
});

export const AriaDescription = meta.story({
  args: {
    ariaLabel: 'Button',
    ariaDescription: 'Clicking this button allegedly makes you happy.',
    children: <FaceHappyIcon />,
  },
});

export const Shortcut = meta.story({
  args: {
    ariaLabel: false,
    children: 'Button',
    shortcut: ['Control', 'Shift', 'H'],
  },
});

export const ShortcutAndTooltip = meta.story({
  args: {
    ariaLabel: false,
    children: 'Button',
    tooltip: 'A button can be pressed to perform an action',
    shortcut: ['Control', 'Shift', 'H'],
  },
});

export const ShortcutAndDefaultTooltip = meta.story({
  args: {
    ariaLabel: 'Button',
    children: <FaceHappyIcon />,
    shortcut: ['Control', 'Shift', 'H'],
  },
});
