/* eslint-disable */
import React from 'react';
import Button from './Button';

import { storiesOf, configure } from '@storybook/react';
import { action } from '@storybook/addon-actions';

storiesOf('Button', module).add('basic', () => <Button label="The Button" />);

storiesOf('Button').add('no module', () => <Button label="The Button" />);

storiesOf('Button', module).add('with story parameters', () => <Button label="The Button" />, {
  header: false,
  inline: true,
});

storiesOf('Button', module)
  .addParameters({ foo: 1 })
  .add('with kind parameters', () => <Button label="The Button" />);

storiesOf('Button', module)
  .addParameters({ component: Button })
  .add('with existing component parameters', () => <Button label="The Button" />);

storiesOf('Button', module).add('complex story', () => (
  <div>
    <Button label="The Button" onClick={action('onClick')} />
    <br />
  </div>
));

storiesOf('Root|Some/Button', module).add('with path', () => <Button label="The Button" />);

storiesOf('Some.Button', module).add('with dot-path', () => <Button label="The Button" />);

storiesOf('Some.Button', module)
  .addDecorator(withKnobs)
  .add('with decorator', () => <Button label="The Button" />);

// This isn't a valid story, but it tests the `import { comp } from ...` case
storiesOf('action', module).add('non-default component export', () => <action />);

// This shouldn't get modified since the story name doesn't match
storiesOf('something', module).add('non-matching story', () => <Button label="The Button" />);
