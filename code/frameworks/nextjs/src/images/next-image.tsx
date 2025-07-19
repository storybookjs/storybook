/* eslint-disable @typescript-eslint/ban-ts-comment */
import React from 'react';

// @ts-ignore-error (this only errors during compilation for production)
import { ImageContext as ImageContextValue } from '@storybook/nextjs/dist/image-context';

import type * as _NextImage from 'next/image';
// @ts-ignore import is aliased in webpack config
import * as NextImageNamespace from 'sb-original/next/image';

import { type ImageContext as ImageContextType } from '../image-context';
import { defaultLoader } from './next-image-default-loader';

declare const __STORYBOOK_CUSTOM_LOADER__:
  | ((props: _NextImage.ImageLoaderProps) => string)
  | undefined;

const OriginalNextImage = NextImageNamespace.default;
const { getImageProps: originalGetImageProps } = NextImageNamespace;
const ImageContext = ImageContextValue as typeof ImageContextType;

const MockedNextImage = React.forwardRef<HTMLImageElement, _NextImage.ImageProps>(
  ({ loader, ...props }, ref) => {
    const imageParameters = React.useContext(ImageContext);

    let finalLoader = loader;

    if (!finalLoader && typeof __STORYBOOK_CUSTOM_LOADER__ !== 'undefined') {
      finalLoader = __STORYBOOK_CUSTOM_LOADER__;
    }

    if (!finalLoader) {
      finalLoader = defaultLoader;
    }

    return <OriginalNextImage ref={ref} {...imageParameters} {...props} loader={finalLoader} />;
  }
);

MockedNextImage.displayName = 'NextImage';

export const getImageProps = (props: _NextImage.ImageProps) => {
  let finalLoader = props.loader;

  if (!finalLoader && typeof __STORYBOOK_CUSTOM_LOADER__ !== 'undefined') {
    finalLoader = __STORYBOOK_CUSTOM_LOADER__;
  }

  if (!finalLoader) {
    finalLoader = defaultLoader;
  }
  originalGetImageProps?.({ loader: finalLoader, ...props });
};

export default MockedNextImage;
