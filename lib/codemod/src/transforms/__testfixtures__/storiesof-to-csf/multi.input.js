/* eslint-disable */
import React from 'react';
import Button from './Button';

// If we have multiple storiesOf calls, export multiple defaults. It's not valid
// JS but will still save the user time in converting.

storiesOf('Button1', module)
  .add('story1', () => <Button label="Button1.1" />)
  .add('story2', () => <Button label="Button1.2" />);

storiesOf('Button2', module)
  .add('story1', () => <Button label="Button2.1" />)
  .add('story2', () => <Button label="Button2.2" />);
