import React from 'react';

import { fn } from 'storybook/test';
import { styled } from 'storybook/theming';

import { Field as FieldComponent } from './Field';
import { Input as InputComponent } from './Input';
import { Select as SelectComponent } from './Select';
import { Textarea as TextareaComponent } from './Textarea';

const Flexed = styled(FieldComponent)({ display: 'flex' });

export default {
  title: 'Form/Field',
  component: FieldComponent,
  args: {
    label: 'Label',
  },
};

export const Input = {
  render: (args: any) => (
    <Flexed {...args}>
      <InputComponent value="Text" onChange={fn().mockName('onChange')} />
    </Flexed>
  ),
};

export const Select = {
  render: (args: any) => (
    <Flexed {...args}>
      <SelectComponent value="val2" onChange={fn().mockName('onChange')}>
        <option value="val1">Value 1</option>
        <option value="val2">Value 2</option>
        <option value="val3">Value 3</option>
      </SelectComponent>
    </Flexed>
  ),
};

export const Textarea = {
  render: (args: any) => (
    <Flexed {...args}>
      <TextareaComponent value="Content" onChange={fn().mockName('onChange')} />
    </Flexed>
  ),
};
