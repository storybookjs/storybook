// @ts-ignore import is aliased in webpack config
import OriginalNextLegacyImage from "next/legacy/image";
import { defaultLoader } from "sb-original/default-loader";
import { ImageContext } from "sb-original/image-context";

import React from "next/dist/compiled/react";
import type * as _NextLegacyImage from "next/legacy/image";

function NextLegacyImage({ loader, ...props }: _NextLegacyImage.ImageProps) {
  const imageParameters = React.useContext(ImageContext);

  return (
    <OriginalNextLegacyImage
      {...imageParameters}
      {...props}
      loader={loader ?? defaultLoader}
    />
  );
}

export default NextLegacyImage;
