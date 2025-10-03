declare module 'sb-original/image-context' {
  import type { StaticImport } from 'next/dist/shared/lib/get-img-props';
  import type { Context } from 'next/dist/compiled/react';
  import type { ImageProps } from 'next/image';
  import type { ImageProps as LegacyImageProps } from 'next/legacy/image';

  export const ImageContext: Context<
    Partial<
      Omit<ImageProps, 'src'> & {
        src: string | StaticImport;
      }
    > &
      Omit<LegacyImageProps, 'src'>
  >;
}

declare module 'sb-original/default-loader' {
  import type { ImageLoaderProps } from 'next/image';

  export const defaultLoader: (props: ImageLoaderProps) => string;
}

declare module 'next/dist/compiled/react' {
  import * as React from 'react';
  export default React;
  export type Context<T> = React.Context<T>;
  export function createContext<T>(
    // If you thought this should be optional, see
    // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/24509#issuecomment-382213106
    defaultValue: T
  ): Context<T>;
}
