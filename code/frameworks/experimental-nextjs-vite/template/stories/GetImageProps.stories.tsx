import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { type ImageProps, getImageProps } from 'next/image';

import Accessibility from '../../assets/accessibility.svg';
import Testing from '../../assets/testing.png';

// referenced from https://nextjs.org/docs/pages/api-reference/components/image#theme-detection-picture
const Component = (props: Omit<ImageProps, 'src'>) => {
  const {
    props: { srcSet: dark },
  } = getImageProps({ src: Accessibility, ...props });
  const {
    // capture rest on one to spread to img as default; it doesn't matter which barring art direction
    props: { srcSet: light, ...rest },
  } = getImageProps({ src: Testing, ...props });

  return (
    <picture>
      <source media="(prefers-color-scheme: dark)" srcSet={dark} />
      <source media="(prefers-color-scheme: light)" srcSet={light} />
      <img {...rest} />
    </picture>
  );
};

const meta = {
  component: Component,
  args: {
    alt: 'getImageProps Example',
  },
} satisfies Meta<typeof Component>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
