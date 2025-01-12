/* eslint-disable */
import React from 'react';
import Button from './Button';

import { storiesOf } from '@storybook/react';

storiesOf('Button', module)
  .addParameters({ component: Button, foo: 1 })
  .addParameters({ bar: 2 })
  .add('with kind parameters', () => <Button label="The Button" />);
