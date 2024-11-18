// @ts-expect-error import is aliased in webpack config
import React from 'next/dist/compiled/react';
import * as NextImageNamespace from 'next/image';
import type * as _NextImage from 'next/image';
import { defaultLoader } from 'sb-original/default-loader';
import { ImageContext } from 'sb-original/image-context';

const OriginalNextImage = NextImageNamespace.default;
const { getImageProps: originalGetImageProps } = NextImageNamespace;

const MockedNextImage = React.forwardRef<HTMLImageElement, _NextImage.ImageProps>(
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
