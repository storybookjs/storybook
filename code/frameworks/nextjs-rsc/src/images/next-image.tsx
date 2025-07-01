'use client';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore (this only errors during compilation for production)
import { ImageContext as ImageContextValue } from '@storybook/experimental-nextjs-rsc/dist/image-context';

// @ts-expect-error no types
import React from 'next/dist/compiled/react';
import type * as _NextImage from 'next/image';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore import is aliased in webpack config
import * as NextImageNamespace from 'sb-original/next/image';

import { type ImageContext as ImageContextType } from '../image-context';
import { defaultLoader } from './next-image-default-loader';

const OriginalNextImage = NextImageNamespace.default;
const { getImageProps: originalGetImageProps } = NextImageNamespace;
const ImageContext = ImageContextValue as typeof ImageContextType;

const MockedNextImage = React.forwardRef<HTMLImageElement, _NextImage.ImageProps>(
  // @ts-expect-error no types
  ({ loader, ...props }, ref) => {
    const imageParameters = React.useContext(ImageContext);

    return (
      <OriginalNextImage
        ref={ref}
        {...imageParameters}
        {...props}
        loader={loader ?? defaultLoader}
      />
    );
  }
);

MockedNextImage.displayName = 'NextImage';

export const getImageProps = (props: _NextImage.ImageProps) =>
  originalGetImageProps?.({ loader: defaultLoader, ...props });

export default MockedNextImage;
