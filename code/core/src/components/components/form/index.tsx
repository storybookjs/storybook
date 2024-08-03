import { styled } from '@storybook/core/theming';
import { Field } from './field/field';
import { Input, Select, Textarea } from './input/input';
import { Button } from '../Button/Button';

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
