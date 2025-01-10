import React from 'react';

import { AddIcon, FaceHappyIcon, HomeIcon, SubtractIcon } from '@storybook/icons';

import { IconGallery, IconItem } from './IconGallery';

export default {
  component: IconGallery,
};

export const DefaultStyle = () => (
  <IconGallery>
    <IconItem name="add">
      <AddIcon />
    </IconItem>
    <IconItem name="subtract">
      <SubtractIcon />
    </IconItem>
    <IconItem name="home">
      <HomeIcon />
    </IconItem>
    <IconItem name="facehappy">
      <FaceHappyIcon />
    </IconItem>
    <IconItem name="bar">
      <img src="https://storybook.js.org/images/placeholders/50x50.png" alt="example" />
    </IconItem>
    <IconItem name="bar">
      <img src="https://storybook.js.org/images/placeholders/50x50.png" alt="example" />
    </IconItem>
  </IconGallery>
);
