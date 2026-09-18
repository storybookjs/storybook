import { getImageProps } from 'next/image';
import React from 'react';

import Accessibility from './assets/accessibility.svg';
import Testing from './assets/testing.png';

// referenced from https://nextjs.org/docs/pages/api-reference/components/image#theme-detection-picture
const Component: React.FC<any> = (props) => {
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

export default {
  component: Component,
  args: {
    alt: 'getImageProps Example',
  },
};

export const Default = {};
