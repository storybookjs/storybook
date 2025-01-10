/* eslint-disable */
import React from 'react';
import Button from './Button';

// This isn't a valid story, but it tests the `import { comp } from ...` case
storiesOf('Some.Button', module)
  .addDecorator(withKnobs)
  .addDecorator((storyFn) => <div className="foo">{storyFn}</div>)
  .add('with decorator', () => <Button label="The Button" />);
