import { styled } from 'storybook/theming';

import { Button } from '../Button/Button';
import { Checkbox } from './Checkbox';
import { Field } from './Field';
import { Input, Select, Textarea } from './Input';
import { Radio } from './Radio';

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
