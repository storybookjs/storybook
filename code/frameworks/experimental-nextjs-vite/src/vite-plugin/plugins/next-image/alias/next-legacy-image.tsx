// @ts-expect-error import is aliased in webpack config
import React from 'next/dist/compiled/react';
import OriginalNextLegacyImage from 'next/legacy/image';
import type * as _NextLegacyImage from 'next/legacy/image';
import { defaultLoader } from 'sb-original/default-loader';
import { ImageContext } from 'sb-original/image-context';

function NextLegacyImage({ loader, ...props }: _NextLegacyImage.ImageProps) {
  const imageParameters = React.useContext(ImageContext);

  return (
    <OriginalNextLegacyImage {...imageParameters} {...props} loader={loader ?? defaultLoader} />
  );
}

export default NextLegacyImage;
