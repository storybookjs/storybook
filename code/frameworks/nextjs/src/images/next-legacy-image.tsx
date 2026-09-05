/* eslint-disable @typescript-eslint/ban-ts-comment */
import React from 'react';

// @ts-ignore-error (this only errors during compilation for production)
import { ImageContext as ImageContextValue } from '@storybook/nextjs/image-context';

import type * as _NextLegacyImage from 'next/legacy/image';
// @ts-ignore import is aliased in webpack config
import imageLoader from '@storybook/nextjs/image-loader';
// @ts-ignore import is aliased in webpack config
import OriginalNextLegacyImage from 'sb-original/next/legacy/image';

import { type ImageContext as ImageContextType } from '../image-context.ts';

const ImageContext = ImageContextValue as typeof ImageContextType;

function NextLegacyImage({ loader, ...props }: _NextLegacyImage.ImageProps) {
  const imageParameters = React.useContext(ImageContext);

  return <OriginalNextLegacyImage {...imageParameters} {...props} loader={loader ?? imageLoader} />;
}

export default NextLegacyImage;
