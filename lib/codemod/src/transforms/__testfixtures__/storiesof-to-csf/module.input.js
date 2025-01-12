/* eslint-disable */
import React from 'react';
import Button from './Button';
import { storiesOf } from '@storybook/react';

export default {
  title: 'foo',
};

const bar = 1;

storiesOf('foo', module).add('bar', () => <Button />);
