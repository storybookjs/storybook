import { createContext } from 'next/dist/compiled/react';
import type { ImageProps, StaticImageData } from 'next/image';
import type { ImageProps as LegacyImageProps } from 'next/legacy/image';

// StaticRequire needs to be in scope for the TypeScript compiler to work.
// See: https://github.com/microsoft/TypeScript/issues/5711
// Since next/image doesn't export StaticRequire we need to re-define it here and set src's type to it.
interface StaticRequire {
  default: StaticImageData;
}

declare type StaticImport = StaticRequire | StaticImageData;

export const ImageContext = createContext<
  Partial<Omit<ImageProps, 'src'> & { src: string | StaticImport }> & Omit<LegacyImageProps, 'src'>
>({});
