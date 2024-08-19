import { styled } from '@storybook/core/theming';

import { Button } from '../Button/Button';
import { Field } from './field/field';
import { Input, Select, Textarea } from './input/input';

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
  }
);
