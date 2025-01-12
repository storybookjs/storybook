/* eslint-disable */
import React from 'react';
import Button from './Button';

import { storiesOf } from '@storybook/react';

storiesOf('Button', module)
  .add('with story parameters', () => <Button label="The Button" />, {
    header: false,
    inline: true,
  })
  .add('foo', () => <Button label="Foo" />, {
    bar: 1,
  });
