import React from 'react';

import { styled } from 'storybook/internal/theming';

import { FaceHappyIcon } from '@storybook/icons';

import preview from '../../../../../.storybook/preview';
import { Select } from './SelectActiveDescendant';

const meta = preview.meta({
  id: 'select-component-activedescendant',
  title: 'Select active descendant',
  component: Select,
  args: { children: 'Select' },
});

const Stack = styled.div({ display: 'flex', flexDirection: 'column', gap: '1rem' });

const Row = styled.div({ display: 'flex', alignItems: 'center', gap: '1rem' });

const options = [
  { label: 'Tadpole', value: 'tadpole' },
  { label: 'Pollywog', value: 'pollywog' },
  { label: 'Frog', value: 'frog' },
];

export const Base = meta.story({
  args: {
    options,
  },
});

export const Variants = meta.story({
  args: {
    options,
  },
  render: (args) => (
    <Stack>
      <Row>
        <Select variant="solid" {...args}>
          Solid
        </Select>
        <Select variant="outline" {...args}>
          Outline
        </Select>
        <Select variant="ghost" {...args}>
          Ghost
        </Select>
      </Row>
      <Row>
        <Select variant="solid" {...args}>
          <FaceHappyIcon /> Solid
        </Select>
        <Select variant="outline" {...args}>
          <FaceHappyIcon /> Outline
        </Select>
        <Select variant="ghost" {...args}>
          <FaceHappyIcon /> Ghost
        </Select>
      </Row>
      <Row>
        <Select variant="solid" padding="small" {...args}>
          <FaceHappyIcon />
        </Select>
        <Select variant="outline" padding="small" {...args}>
          <FaceHappyIcon />
        </Select>
        <Select variant="ghost" padding="small" {...args}>
          <FaceHappyIcon />
        </Select>
      </Row>
    </Stack>
  ),
});

export const PseudoStates = meta.story({
  args: {
    options,
  },
  render: (args) => (
    <Stack>
      <Row>
        <Select variant="solid" {...args}>
          Select
        </Select>
        <Select variant="outline" {...args}>
          Select
        </Select>
        <Select variant="ghost" {...args}>
          Select
        </Select>
      </Row>
      <Row id="hover">
        <Select variant="solid" {...args}>
          Hover
        </Select>
        <Select variant="outline" {...args}>
          Hover
        </Select>
        <Select variant="ghost" {...args}>
          Hover
        </Select>
      </Row>
      <Row id="focus">
        <Select variant="solid" {...args}>
          Focus
        </Select>
        <Select variant="outline" {...args}>
          Focus
        </Select>
        <Select variant="ghost" {...args}>
          Focus
        </Select>
      </Row>
    </Stack>
  ),
  parameters: {
    pseudo: {
      hover: '#hover button',
      focus: '#focus button',
      active: '#active button',
    },
  },
});

export const ManyOptions = meta.story({
  args: {
    options: Array.from({ length: 20 }, (_, i) => ({
      label: `Option ${i + 1}`,
      value: `option-${i + 1}`,
    })),
  },
});
