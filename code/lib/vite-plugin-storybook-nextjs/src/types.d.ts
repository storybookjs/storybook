declare module "sb-original/image-context" {
  import type { StaticImport } from "next/dist/shared/lib/get-img-props";
  import type { Context } from "react";
  import type { ImageLoaderProps, ImageProps } from "next/image";
  import type { ImageProps as LegacyImageProps } from "next/legacy/image";

  export const ImageContext: Context<
    Partial<
      Omit<ImageProps, "src"> & {
        src: string | StaticImport;
      }
    > &
      Omit<LegacyImageProps, "src">
  >;
}

declare module "sb-original/default-loader" {
  import type { ImageLoaderProps } from "next/image";

  export const defaultLoader: (props: ImageLoaderProps) => string;
}
