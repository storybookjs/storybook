import React from 'react';
import { styled } from '@storybook/core/theming';
import { action } from '@storybook/addon-actions';

import * as InputComponents from './input/input';
import { Field as FieldComponent } from './field/field';

const Flexed = styled(FieldComponent)({ display: 'flex' });

export default {
  title: 'Form',
};

const sharedArgTypes = {
  disabled: {
    defaultValue: false,
    control: {
      type: 'boolean',
    },
  },
  size: {
    defaultValue: 'auto',
    control: {
      type: 'radio',
      // TODO: weak typings
      options: ['100%', 'auto', 'flex'] as InputComponents.Sizes[],
    },
  },
  valid: {
    control: {
      type: 'radio',
      // TODO: weak typings
      options: [null, 'valid', 'warn', 'error'] as InputComponents.ValidationStates[],
    },
  },
  align: {
    control: {
      type: 'radio',
      // TODO: weak typings
      options: [null, 'start', 'center', 'end'] as InputComponents.Alignments[],
    },
  },
};

export const Field = {
  render: (args: any) => (
    <FieldComponent key="key" {...args}>
      <InputComponents.Select value="val2" onChange={action('onChange')}>
        <option value="val1">Value 1</option>
        <option value="val2">Value 2</option>
        <option value="val3">Value 3</option>
      </InputComponents.Select>
    </FieldComponent>
  ),
  argTypes: {
    label: {
      defaultValue: 'label',
      control: {
        type: 'text',
      },
    },
  },
};

export const Select = {
  render: (args: any) => (
    <Flexed>
      <InputComponents.Select onChange={action('onChange')} {...args}>
        <option value="val1">Value 1</option>
        <option value="val2">Value 2</option>
        <option value="val3">Value 3</option>
      </InputComponents.Select>
    </Flexed>
  ),
  argTypes: {
    ...sharedArgTypes,
    value: {
      defaultValue: 'val2',
      control: {
        type: 'radio',
        options: ['val1', 'val2', 'val3'],
      },
    },
  },
};

export const Textarea = {
  render: (args: any) => (
    <Flexed>
      <InputComponents.Textarea {...args} />
    </Flexed>
  ),
  argTypes: {
    ...sharedArgTypes,
    height: {
      control: {
        type: 'number',
      },
    },
  },
};

export const Input = {
  render: (args: any) => (
    <Flexed>
      <InputComponents.Input {...args} />
    </Flexed>
  ),
  argTypes: {
    ...sharedArgTypes,
    value: {
      control: {
        type: 'text',
      },
    },
    placeholder: {
      control: {
        type: 'text',
      },
      defaultValue: 'Placeholder',
    },
  },
};
