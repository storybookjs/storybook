// loader-utils v3 ships no types, and @types/loader-utils@2 is written against webpack 4's
// `loader.LoaderContext`. Declare the one helper we use against webpack 5.
declare module 'loader-utils' {
  import type { LoaderContext } from 'webpack';

  export function interpolateName(
    loaderContext: LoaderContext<unknown>,
    name: string | ((resourcePath: string, resourceQuery?: string) => string),
    options?: { context?: string; content?: string | Buffer; regExp?: string | RegExp }
  ): string;
}
