/* eslint-disable @typescript-eslint/ban-ts-comment */
import React from 'react';

// @ts-ignore-error (this only errors during compilation for production)
import { ImageContext as ImageContextValue } from '@storybook/nextjs/dist/image-context';

import type * as _NextLegacyImage from 'next/legacy/image';
// @ts-ignore import is aliased in webpack config
import OriginalNextLegacyImage from 'sb-original/next/legacy/image';

import { type ImageContext as ImageContextType } from '../image-context';
import { defaultLoader } from './next-image-default-loader';

const ImageContext = ImageContextValue as typeof ImageContextType;

function NextLegacyImage({ loader, ...props }: _NextLegacyImage.ImageProps) {
  const imageParameters = React.useContext(ImageContext);

  return (
    <OriginalNextLegacyImage {...imageParameters} {...props} loader={loader ?? defaultLoader} />
  );
}

export default NextLegacyImage;
