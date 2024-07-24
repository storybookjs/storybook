// @ts-ignore import is aliased in webpack config
import OriginalNextLegacyImage from "next/legacy/image";
import { defaultLoader } from "sb-original/default-loader";
import { ImageContext } from "sb-original/image-context";

import type * as _NextLegacyImage from "next/legacy/image";
import React from "react";

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
