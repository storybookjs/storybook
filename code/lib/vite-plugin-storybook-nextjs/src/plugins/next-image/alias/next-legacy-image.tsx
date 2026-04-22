// @ts-ignore import is aliased in webpack config
import * as _NextLegacyImageNamespace from "next/legacy/image";
import { defaultLoader } from "sb-original/default-loader";
import { ImageContext } from "sb-original/image-context";

import React from "next/dist/compiled/react";
import type * as _NextLegacyImage from "next/legacy/image";

// Handle ambiguous default import from CJS module.
// See: https://rolldown.rs/in-depth/bundling-cjs#recommendations-for-library-authors
const _rawLegacy = _NextLegacyImageNamespace.default;
const OriginalNextLegacyImage =
  typeof _rawLegacy === "object" && _rawLegacy !== null && "__esModule" in _rawLegacy
    ? (_rawLegacy as Record<string, typeof _rawLegacy>).default
    : _rawLegacy;

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
