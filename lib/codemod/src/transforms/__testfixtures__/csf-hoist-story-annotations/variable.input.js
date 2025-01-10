import React from 'react';
import Button from './Button';

const foo = {
  title: 'Button',
};

export default foo;

const bar = () => <Button label="Story 1" />;
bar.story = { name: 'bar bar' };

export const story1 = bar;
