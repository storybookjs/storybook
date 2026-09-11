import { styled } from 'storybook/theming';

import { Button } from '../Button/Button.tsx';
import { Checkbox } from './Checkbox.tsx';
import { Field } from './Field.tsx';
import { Input } from './Input.tsx';
import { Radio } from './Radio.tsx';
import { Select } from './Select.tsx';
import { Textarea } from './Textarea.tsx';

export const Form = Object.assign(
  styled.form({
    boxSizing: 'border-box',
    width: '100%',
  }),
  {
    Field,
    Input,
    Select,
    Textarea,
    Button,
    Checkbox,
    Radio,
  }
);
