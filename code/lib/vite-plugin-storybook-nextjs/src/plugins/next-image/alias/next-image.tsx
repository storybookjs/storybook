// @ts-ignore import is aliased in webpack config
import * as NextImageNamespace from "next/image";
import type * as _NextImage from "next/image";

import { defaultLoader } from "sb-original/default-loader";
import { ImageContext } from "sb-original/image-context";

import React from "next/dist/compiled/react";

// Handle ambiguous default import from CJS module.
// See: https://rolldown.rs/in-depth/bundling-cjs#recommendations-for-library-authors
const _raw = NextImageNamespace.default;
const OriginalNextImage =
  typeof _raw === "object" && _raw !== null && "__esModule" in _raw
    ? (_raw as Record<string, typeof _raw>).default
    : _raw;
const originalGetImageProps =
  NextImageNamespace.getImageProps ??
  (typeof _raw === "object" && _raw !== null && "getImageProps" in _raw
    ? (_raw as Record<string, typeof NextImageNamespace.getImageProps>)
        .getImageProps
    : undefined);

const MockedNextImage = React.forwardRef<
  HTMLImageElement,
  _NextImage.ImageProps
>(({ loader, ...props }, ref) => {
  const imageParameters = React.useContext(ImageContext);

  return (
    <OriginalNextImage
      ref={ref}
      {...imageParameters}
      {...props}
      loader={loader ?? defaultLoader}
    />
  );
});

MockedNextImage.displayName = "NextImage";

export const getImageProps = (props: _NextImage.ImageProps) =>
  originalGetImageProps?.({ loader: defaultLoader, ...props });

export default MockedNextImage;
