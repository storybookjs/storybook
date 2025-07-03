import { styled } from 'storybook/theming';

import { Button } from '../Button/Button';
import { Checkbox } from './Checkbox';
import { Field } from './Field';
import { Input } from './Input';
import { Radio } from './Radio';
import { Select } from './Select';
import { Textarea } from './Textarea';

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
