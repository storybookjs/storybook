import React from 'react';
import Button from './Button';

storiesOf('Some.Button', module)
  .add('with story params and decorators', () => <Button label="The Button" />, {
    bar: 1,
    decorators: [withKnobs, (storyFn) => <div className="foo">{storyFn}</div>],
  })
  .add('with story decorators', () => <Button label="The Button" />, {
    decorators: [withKnobs],
  });
