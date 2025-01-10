import React from 'react';
import Button from './Button';
import { action } from '@storybook/addon-actions';

export default {
  title: 'Button',
};

export const story1 = () => <Button label="Story 1" />;

export const story2 = () => <Button label="Story 2" onClick={action('click')} />;
story2.story = { name: 'second story' };
story2.story.parameters = { foo: 'bar' };

export const story3 = () => (
  <div>
    <Button label="The Button" onClick={action('onClick')} />
    <br />
  </div>
);
const baz = 17;
story3.story = {};
story3.story.name = 'complex story';
story3.story.parameters = { foo: { bar: baz } };
story3.story.decorators = [(storyFn) => <bar>{storyFn}</bar>];
